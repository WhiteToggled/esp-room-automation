import os
import json
import re
import sqlite3
from contextlib import asynccontextmanager
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, field_validator
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, or_
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import paho.mqtt.client as mqtt
from apscheduler.schedulers.background import BackgroundScheduler
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# Monkeypatch SQLAlchemy's SQLite dialect for pysqlcipher3 compatibility
import sqlalchemy.dialects.sqlite.pysqlite as pysqlite
import sqlalchemy.dialects.sqlite.pysqlcipher as pysqlcipher
from sqlalchemy.dialects.sqlite.pysqlite import SQLiteDialect_pysqlite


def _custom_regexp(pattern, item):
    if item is None:
        return False
    try:
        return re.search(pattern, str(item), re.I) is not None
    except Exception:
        return False


def patched_set_regexp(dbapi_connection):
    try:
        dbapi_connection.create_function(
            "REGEXP", 2, _custom_regexp, deterministic=True
        )
    except TypeError:
        dbapi_connection.create_function("REGEXP", 2, _custom_regexp)


pysqlite.set_regexp = patched_set_regexp
pysqlcipher.set_regexp = patched_set_regexp


def patched_on_connect(self):
    return patched_set_regexp


SQLiteDialect_pysqlite.on_connect = patched_on_connect

# --- Configuration ---
DB_PASSPHRASE = os.environ["DB_PASSPHRASE"]
DATABASE_URL = f"sqlite+pysqlcipher://:{DB_PASSPHRASE}@/./automation.db"
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
LOG_INTERVAL_MINUTES = int(os.getenv("LOG_INTERVAL_MINUTES", 5))

# JWT Configuration
SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- In-Memory State ---
device_states: Dict[str, int] = {}

# --- Hardcoded superuser (admin only) ---
USERS_DB = {
    "admin": {
        "username": "admin",
        "hashed_password": pwd_context.hash(os.environ["ADMIN_PASSWORD"]),
        "role": "admin",
        "rooms": [],  # admin is unrestricted — no room filter applied
    },
}

# --- Persistent users DB ---
USERS_DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


# --- rooms helpers: DB column `room` stores comma-separated room IDs ---
def _parse_rooms(room_str: Optional[str]) -> List[str]:
    if not room_str:
        return []
    return [r.strip() for r in room_str.split(",") if r.strip()]


def _serialize_rooms(rooms: List[str]) -> str:
    return ",".join(rooms)


def init_users_db():
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                room TEXT
            )
            """
        )
        # Migrate older tables that may not have the room column yet
        try:
            cur.execute("ALTER TABLE users ADD COLUMN room TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists
        con.commit()
    finally:
        con.close()


def get_persisted_user(username: str) -> Optional[Dict]:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT username, password_hash, role, room FROM users WHERE username = ?",
            (username,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "username": row[0],
            "hashed_password": row[1],
            "role": row[2],
            "rooms": _parse_rooms(row[3]),
        }
    finally:
        con.close()


def persist_user(
    username: str,
    password_hash: str,
    role: str = "user",
    rooms: Optional[List[str]] = None,
) -> None:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (username, password_hash, role, room) VALUES (?, ?, ?, ?)",
            (username, password_hash, role, _serialize_rooms(rooms or [])),
        )
        con.commit()
    finally:
        con.close()


def update_user_rooms_in_db(username: str, rooms: List[str]) -> bool:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "UPDATE users SET room = ? WHERE username = ?",
            (_serialize_rooms(rooms), username),
        )
        con.commit()
        return cur.rowcount > 0
    finally:
        con.close()


# --- Database Setup ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)  # e.g., "r1/l1"


class StateLog(Base):
    __tablename__ = "state_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    snapshot = Column(Text, nullable=False)


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, nullable=False)      # e.g., "r1/l1"
    action = Column(Integer, nullable=False)        # 0 = off, 1 = on
    hour = Column(Integer, nullable=False)          # 0-23
    minute = Column(Integer, nullable=False)        # 0-59
    days = Column(String, nullable=False)           # comma-separated: "mon,tue,wed,thu,fri"
    enabled = Column(Integer, default=1, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


Base.metadata.create_all(bind=engine)


# --- Pydantic Models ---
class ToggleResponse(BaseModel):
    id: str
    new_state: int


class StateLogEntry(BaseModel):
    id: int
    logged_at: datetime
    snapshot: Dict[str, int]

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    rooms: List[str] = []


class UserRoomsUpdate(BaseModel):
    rooms: List[str]


class ScheduleCreate(BaseModel):
    device_id: str
    action: int
    hour: int
    minute: int
    days: List[str]
    enabled: bool = True

    @field_validator("action")
    @classmethod
    def action_must_be_binary(cls, v):
        if v not in (0, 1):
            raise ValueError("action must be 0 or 1")
        return v

    @field_validator("hour")
    @classmethod
    def hour_range(cls, v):
        if not 0 <= v <= 23:
            raise ValueError("hour must be 0-23")
        return v

    @field_validator("minute")
    @classmethod
    def minute_range(cls, v):
        if not 0 <= v <= 59:
            raise ValueError("minute must be 0-59")
        return v

    @field_validator("days")
    @classmethod
    def days_valid(cls, v):
        normalized = [d.lower() for d in v]
        invalid = [d for d in normalized if d not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Invalid days: {invalid}. Valid: mon,tue,wed,thu,fri,sat,sun")
        if not normalized:
            raise ValueError("At least one day must be specified")
        return normalized


class ScheduleUpdate(BaseModel):
    action: Optional[int] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    days: Optional[List[str]] = None
    enabled: Optional[bool] = None

    @field_validator("action")
    @classmethod
    def action_must_be_binary(cls, v):
        if v is not None and v not in (0, 1):
            raise ValueError("action must be 0 or 1")
        return v

    @field_validator("hour")
    @classmethod
    def hour_range(cls, v):
        if v is not None and not 0 <= v <= 23:
            raise ValueError("hour must be 0-23")
        return v

    @field_validator("minute")
    @classmethod
    def minute_range(cls, v):
        if v is not None and not 0 <= v <= 59:
            raise ValueError("minute must be 0-59")
        return v

    @field_validator("days")
    @classmethod
    def days_valid(cls, v):
        if v is None:
            return v
        normalized = [d.lower() for d in v]
        invalid = [d for d in normalized if d not in VALID_DAYS]
        if invalid:
            raise ValueError(f"Invalid days: {invalid}. Valid: mon,tue,wed,thu,fri,sat,sun")
        if not normalized:
            raise ValueError("At least one day must be specified")
        return normalized


class ScheduleResponse(BaseModel):
    id: int
    device_id: str
    action: int
    hour: int
    minute: int
    days: List[str]
    enabled: bool
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Auth Helpers ---


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = USERS_DB.get(username)
    if user is None:
        persisted = get_persisted_user(username)
        if persisted:
            user = persisted
    if user is None:
        raise credentials_exception
    return user


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required.",
        )
    return current_user


# --- RBAC Helpers ---


def get_room_from_device(device_id: str) -> Optional[str]:
    parts = device_id.split("/")
    return parts[0] if len(parts) >= 2 else None


def can_access_room(user: dict, room: str) -> bool:
    """Admin has unrestricted access; regular users must have the room in their assigned list."""
    if user.get("role") == "admin":
        return True
    return room in (user.get("rooms") or [])


def _schedule_to_response(sched: Schedule) -> ScheduleResponse:
    return ScheduleResponse(
        id=sched.id,
        device_id=sched.device_id,
        action=sched.action,
        hour=sched.hour,
        minute=sched.minute,
        days=[d.strip() for d in sched.days.split(",") if d.strip()],
        enabled=bool(sched.enabled),
        created_by=sched.created_by,
        created_at=sched.created_at,
    )


# --- MQTT Setup ---
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)


def on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print("Connected to MQTT Broker!")
        client.subscribe("#")
    else:
        print(f"Failed to connect, return code {rc}")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        if payload in ["0", "1"]:
            device_states[msg.topic] = int(payload)
            print(f"State updated: {msg.topic} -> {payload}")
    except Exception as e:
        print(f"Error processing MQTT message on {msg.topic}: {e}")


mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT broker: {e}")


# --- Cron Job: Periodic State Logger ---
def log_device_states():
    db = SessionLocal()
    try:
        devices = db.query(Device).all()
        if not devices:
            return
        snapshot = {d.id: device_states.get(d.id, 0) for d in devices}
        entry = StateLog(logged_at=datetime.utcnow(), snapshot=json.dumps(snapshot))
        db.add(entry)
        db.commit()
        print(f"[{entry.logged_at.isoformat()}] State snapshot logged: {snapshot}")
    except Exception as e:
        print(f"State logger error: {e}")
        db.rollback()
    finally:
        db.close()


# --- Cron Job: Schedule Executor ---
def run_scheduled_actions():
    """Runs every minute; fires any enabled schedule matching the current hour, minute, and day."""
    now = datetime.now()
    current_day = now.strftime("%a").lower()  # 'mon', 'tue', ...

    db = SessionLocal()
    try:
        due = db.query(Schedule).filter(
            Schedule.enabled == 1,
            Schedule.hour == now.hour,
            Schedule.minute == now.minute,
        ).all()
        for sched in due:
            allowed_days = {d.strip() for d in sched.days.split(",") if d.strip()}
            if current_day not in allowed_days:
                continue
            device_states[sched.device_id] = sched.action
            mqtt_client.publish(sched.device_id, str(sched.action), qos=1, retain=True)
            print(f"[Scheduler] id={sched.id} {sched.device_id} -> {sched.action}")
    except Exception as e:
        print(f"Schedule runner error: {e}")
    finally:
        db.close()


# --- Scheduler Setup ---
scheduler = BackgroundScheduler()
scheduler.add_job(
    log_device_states,
    trigger="interval",
    minutes=LOG_INTERVAL_MINUTES,
    id="state_logger",
    name="Periodic device state logger",
    replace_existing=True,
)
scheduler.add_job(
    run_scheduled_actions,
    trigger="cron",
    minute="*",
    id="schedule_runner",
    name="Per-minute schedule executor",
    replace_existing=True,
)


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    initial_devices = [
        "r1/l1", "r1/l2", "r1/l3", "r1/l4",
        "r1/l5", "r1/l6", "r1/f1", "r1/f2",
    ]
    db = SessionLocal()
    try:
        desired = set(initial_devices)
        existing = {d.id for d in db.query(Device).all()}
        for name in desired - existing:
            db.add(Device(id=name))
        for name in existing - desired:
            db.query(Device).filter(Device.id == name).delete()
        db.commit()
    finally:
        db.close()

    init_users_db()
    scheduler.start()
    print(f"State logger started — interval: every {LOG_INTERVAL_MINUTES} minute(s)")
    print("Schedule executor started — runs every minute")

    yield

    scheduler.shutdown(wait=False)
    mqtt_client.loop_stop()
    mqtt_client.disconnect()


# --- FastAPI App ---
app = FastAPI(
    title="ESP Room Automation API",
    description="Control lights and fans via MQTT and SQLCipher, with per-user lighting schedules and RBAC.",
    version="4.0.0",
    lifespan=lifespan,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Authentication Endpoints ---


@app.post("/login", tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = USERS_DB.get(form_data.username) or get_persisted_user(form_data.username)
    if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user.get("role", "user"),
        "rooms": user.get("rooms", []),
    }


@app.get("/me", tags=["Auth"])
def me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user.get("username"),
        "role": current_user.get("role", "user"),
        "rooms": current_user.get("rooms", []),
    }


# --- Admin: User Management ---


@app.post("/users", status_code=201, tags=["Admin"])
def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin),
):
    """Admin only: create a user account and assign it to one or more rooms."""
    uname = user_data.username.strip()
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(user_data.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if uname in USERS_DB:
        raise HTTPException(status_code=400, detail="Username already exists")
    if get_persisted_user(uname) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = pwd_context.hash(user_data.password)
    try:
        persist_user(uname, hashed, role="user", rooms=user_data.rooms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create user: {e}")

    return {"username": uname, "role": "user", "rooms": user_data.rooms}


@app.get("/users", tags=["Admin"])
def list_users(current_user: dict = Depends(require_admin)):
    """Admin only: list all user accounts with their assigned rooms."""
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute("SELECT username, role, room FROM users ORDER BY username")
        return [
            {"username": r[0], "role": r[1], "rooms": _parse_rooms(r[2])}
            for r in cur.fetchall()
        ]
    finally:
        con.close()


@app.put("/users/{username}/rooms", tags=["Admin"])
def assign_user_rooms(
    username: str,
    data: UserRoomsUpdate,
    current_user: dict = Depends(require_admin),
):
    """Admin only: replace a user's room assignments."""
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    if not update_user_rooms_in_db(username, data.rooms):
        raise HTTPException(status_code=500, detail="Failed to update rooms")
    return {"username": username, "rooms": data.rooms}


@app.delete("/users/{username}", tags=["Admin"])
def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    """Admin only: delete a user account."""
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute("DELETE FROM users WHERE username = ?", (username,))
        con.commit()
    finally:
        con.close()
    return {"message": f"User '{username}' deleted"}


# --- Control Endpoints ---


@app.post("/toggle/{device_id:path}", response_model=ToggleResponse, tags=["Control"])
def toggle_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Toggle a device. Users may only control devices in their assigned room(s).
    """
    room = get_room_from_device(device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: room '{room}' is not in your assigned rooms",
        )
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    new_state = 0 if device_states.get(device_id, 0) else 1
    device_states[device_id] = new_state
    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)
    return {"id": device_id, "new_state": new_state}


@app.post("/toggle-all", tags=["Control"])
def toggle_all(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Toggle all registered devices. Admin only."""
    devices = db.query(Device).all()
    if not devices:
        return {"message": "No devices to toggle"}

    any_off = any(device_states.get(d.id, 0) == 0 for d in devices)
    target_state = 1 if any_off else 0
    for device in devices:
        device_states[device.id] = target_state
        mqtt_client.publish(device.id, str(target_state), qos=1, retain=True)

    return {"message": f"All devices set to {target_state}", "count": len(devices), "new_state": target_state}


# --- Monitoring Endpoints ---


@app.get("/states", response_model=Dict[str, int], tags=["Monitoring"])
def get_all_states(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Current device states. Admin sees all; users see only their assigned room(s).
    """
    devices = db.query(Device).all()
    if current_user.get("role") == "admin":
        return {d.id: device_states.get(d.id, 0) for d in devices}

    user_rooms = set(current_user.get("rooms") or [])
    if not user_rooms:
        return {}
    return {
        d.id: device_states.get(d.id, 0)
        for d in devices
        if get_room_from_device(d.id) in user_rooms
    }


@app.get("/logs", response_model=List[StateLogEntry], tags=["Monitoring"])
def get_state_logs(
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Most recent state snapshots, newest first."""
    rows = db.query(StateLog).order_by(StateLog.logged_at.desc()).limit(limit).all()
    return [
        StateLogEntry(id=r.id, logged_at=r.logged_at, snapshot=json.loads(r.snapshot))
        for r in rows
    ]


@app.post("/logs/trigger", tags=["Monitoring"])
def trigger_log_now(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Manually capture an immediate state snapshot."""
    log_device_states()
    latest = db.query(StateLog).order_by(StateLog.logged_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=500, detail="Logging failed")
    return {
        "message": "Snapshot captured",
        "logged_at": latest.logged_at.isoformat(),
        "snapshot": json.loads(latest.snapshot),
    }


# --- Schedule Endpoints ---


@app.post("/schedules", response_model=ScheduleResponse, tags=["Schedules"])
def create_schedule(
    schedule: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Create a schedule for a device. Users may only schedule devices in their assigned room(s).
    """
    room = get_room_from_device(schedule.device_id)
    if not room:
        raise HTTPException(status_code=400, detail="Invalid device_id — expected 'room/device'")
    if not can_access_room(current_user, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: room '{room}' is not in your assigned rooms",
        )
    if not db.query(Device).filter(Device.id == schedule.device_id).first():
        raise HTTPException(status_code=404, detail=f"Device '{schedule.device_id}' not found")

    sched = Schedule(
        device_id=schedule.device_id,
        action=schedule.action,
        hour=schedule.hour,
        minute=schedule.minute,
        days=",".join(schedule.days),
        enabled=1 if schedule.enabled else 0,
        created_by=current_user["username"],
    )
    db.add(sched)
    db.commit()
    db.refresh(sched)
    return _schedule_to_response(sched)


@app.get("/schedules", response_model=List[ScheduleResponse], tags=["Schedules"])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    List schedules. Admin sees all; users see only their assigned room(s).
    """
    if current_user.get("role") == "admin":
        rows = db.query(Schedule).order_by(Schedule.id).all()
    else:
        user_rooms = current_user.get("rooms") or []
        if not user_rooms:
            return []
        rows = (
            db.query(Schedule)
            .filter(or_(*[Schedule.device_id.like(f"{r}/%") for r in user_rooms]))
            .order_by(Schedule.id)
            .all()
        )
    return [_schedule_to_response(r) for r in rows]


@app.get("/schedules/{schedule_id}", response_model=ScheduleResponse, tags=["Schedules"])
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    room = get_room_from_device(sched.device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return _schedule_to_response(sched)


@app.put("/schedules/{schedule_id}", response_model=ScheduleResponse, tags=["Schedules"])
def update_schedule(
    schedule_id: int,
    update: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Partial update — only include fields you want to change."""
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    room = get_room_from_device(sched.device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if update.action is not None:
        sched.action = update.action
    if update.hour is not None:
        sched.hour = update.hour
    if update.minute is not None:
        sched.minute = update.minute
    if update.days is not None:
        sched.days = ",".join(update.days)
    if update.enabled is not None:
        sched.enabled = 1 if update.enabled else 0

    db.commit()
    db.refresh(sched)
    return _schedule_to_response(sched)


@app.delete("/schedules/{schedule_id}", tags=["Schedules"])
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    room = get_room_from_device(sched.device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    db.delete(sched)
    db.commit()
    return {"message": f"Schedule {schedule_id} deleted"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
