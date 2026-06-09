import os
import json
import re
import sqlite3
from contextlib import asynccontextmanager
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import paho.mqtt.client as mqtt
from apscheduler.schedulers.background import BackgroundScheduler
import jwt
from passlib.context import CryptContext

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
        # Try with deterministic=True (SQLAlchemy 2.0 default)
        dbapi_connection.create_function(
            "REGEXP", 2, _custom_regexp, deterministic=True
        )
    except TypeError:
        # Fallback for pysqlcipher3 which doesn't support the deterministic argument
        dbapi_connection.create_function(
            "REGEXP", 2, _custom_regexp
        )

# Patch the module-level function in both dialects
pysqlite.set_regexp = patched_set_regexp
pysqlcipher.set_regexp = patched_set_regexp

# Patch the class method to ensure it uses the patched function
def patched_on_connect(self):
    return patched_set_regexp

SQLiteDialect_pysqlite.on_connect = patched_on_connect

# --- Configuration ---
# Use SQLCipher with a passphrase
DB_PASSPHRASE = os.getenv("DB_PASSPHRASE", "default_secret_passphrase")
DATABASE_URL = f"sqlite+pysqlcipher://:{DB_PASSPHRASE}@/./automation.db"
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
LOG_INTERVAL_MINUTES = int(os.getenv("LOG_INTERVAL_MINUTES", 5))

# JWT Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-super-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- In-Memory State ---
# This dictionary stores the current state of devices, updated by MQTT
device_states: Dict[str, int] = {}

# --- Hardcoded Users (Signup is hardcoded as requested) ---
USERS_DB = {
    "admin": {
        "username": "admin",
        "hashed_password": pwd_context.hash("admin123"),
        "role": "admin",
    },
    "owner": {
        "username": "owner",
        "hashed_password": pwd_context.hash("owner123"),
        "role": "owner",
    },
}

# --- Persistent users DB (lightweight) ---
USERS_DB_PATH = os.path.join(os.path.dirname(__file__), "users.db")


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
                role TEXT NOT NULL DEFAULT 'user'
            )
            """
        )
        con.commit()
    finally:
        con.close()


def get_persisted_user(username: str) -> Optional[Dict]:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute("SELECT username, password_hash, role FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
        if not row:
            return None
        return {"username": row[0], "hashed_password": row[1], "role": row[2]}
    finally:
        con.close()


def persist_user(username: str, password_hash: str, role: str = "user") -> None:
    con = sqlite3.connect(USERS_DB_PATH)
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role),
        )
        con.commit()
    finally:
        con.close()

# --- Database Setup ---
# SQLCipher requires a specific engine setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)  # e.g., "r1/l1", "r1/f1"
    # State is no longer stored in SQLite as per request


class StateLog(Base):
    """Periodic snapshot of all device states."""
    __tablename__ = "state_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    logged_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    # JSON blob: {"r1/l1": 0, "r1/f1": 1, ...}
    snapshot = Column(Text, nullable=False)


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


# --- Auth Helpers ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


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
    # First check in-memory hardcoded users
    user = USERS_DB.get(username)
    if user is None:
        # Then check persisted users DB
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
            detail="Operation not permitted. Admin role required.",
        )
    return current_user


# --- MQTT Setup ---
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)


def on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print("Connected to MQTT Broker!")
        # Wildcard subscription to get all device states
        client.subscribe("#")
    else:
        print(f"Failed to connect, return code {rc}")


def on_message(client, userdata, msg):
    """
    Updates the in-memory device_states dictionary whenever a message arrives.
    Assumes payload is '0' or '1'.
    """
    try:
        topic = msg.topic
        payload = msg.payload.decode()
        if payload in ["0", "1"]:
            device_states[topic] = int(payload)
            print(f"State updated: {topic} -> {payload}")
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
    """
    Cron job that runs every LOG_INTERVAL_MINUTES minutes.
    Reads all device states from the in-memory cache and writes a JSON snapshot to the state_logs table.
    """
    db = SessionLocal()
    try:
        # We only log devices that are registered in the DB
        devices = db.query(Device).all()
        if not devices:
            return

        # Get current states from our in-memory cache
        # If a device isn't in cache yet, assume 0 or skip
        snapshot = {d.id: device_states.get(d.id, 0) for d in devices}
        
        entry = StateLog(
            logged_at=datetime.utcnow(),
            snapshot=json.dumps(snapshot),
        )
        db.add(entry)
        db.commit()
        print(f"[{entry.logged_at.isoformat()}] State snapshot logged: {snapshot}")
    except Exception as e:
        print(f"State logger error: {e}")
        db.rollback()
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


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed devices
    db = SessionLocal()
    try:
        if db.query(Device).count() == 0:
            initial_devices = ["r1/l1", "r1/l2", "r1/l3", "r1/l4", "r1/l5", "r1/l6", "r1/f1", "r1/f2"]
            db.add_all([Device(id=name) for name in initial_devices])
            db.commit()
    finally:
        db.close()

    # Ensure persisted users DB exists
    init_users_db()

    # Start the cron scheduler
    scheduler.start()
    print(f"State logger started — interval: every {LOG_INTERVAL_MINUTES} minute(s)")

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    mqtt_client.loop_stop()
    mqtt_client.disconnect()


# --- FastAPI App ---
app = FastAPI(
    title="ESP Room Automation API",
    description="Control lights and fans via MQTT and SQLCipher, with periodic state logging and RBAC.",
    version="2.0.0",
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
    # Try hardcoded users first
    user = USERS_DB.get(form_data.username)
    if not user:
        # Try persisted users
        user = get_persisted_user(form_data.username)

    if not user or not pwd_context.verify(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    # Include role and username to help clients set UI state without extra calls
    return {"access_token": access_token, "token_type": "bearer", "username": user["username"], "role": user.get("role", "user")}



@app.post("/signup", tags=["Auth"])
def signup(username: str, password: str):
    """
    Registers a new user and returns a JWT on success.
    """
    uname = username.strip()
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="Username too short")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password too short")

    # Check conflicts with hardcoded users
    if uname in USERS_DB:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Check persisted DB
    if get_persisted_user(uname) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = pwd_context.hash(password)
    try:
        persist_user(uname, hashed, role="user")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create user: {e}")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": uname}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "username": uname, "role": "user"}


@app.get('/me', tags=['Auth'])
def me(current_user: dict = Depends(get_current_user)):
    """Return basic info about the current user from the token."""
    return {"username": current_user.get("username"), "role": current_user.get("role", "user")}


# --- Control Endpoints ---

@app.post("/toggle/{device_id:path}", response_model=ToggleResponse, tags=["Control"])
def toggle_device(
    device_id: str, 
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Toggles a specific device (e.g., 'r1/l1').
    Uses the in-memory MQTT cache to determine current state.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    # Determine current state from cache, default to 0
    current_state = device_states.get(device_id, 0)
    new_state = 1 if current_state == 0 else 0
    
    # Update cache immediately (optimistic update)
    device_states[device_id] = new_state
    
    # Publish to MQTT with retain=True so it survives restarts
    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)
    
    return {"id": device_id, "new_state": new_state}


@app.post("/toggle-all", tags=["Control"])
def toggle_all(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin)
):
    """
    Toggles all registered devices. Admin only.
    """
    devices = db.query(Device).all()
    if not devices:
        return {"message": "No devices to toggle"}

    # We toggle based on the majority state or just flip everything
    # For simplicity, we'll turn everything ON if any are OFF, else turn everything OFF
    any_off = any(device_states.get(d.id, 0) == 0 for d in devices)
    target_state = 1 if any_off else 0
    
    for device in devices:
        device_states[device.id] = target_state
        mqtt_client.publish(device.id, str(target_state), qos=1, retain=True)

    return {
        "message": f"All devices set to {target_state}",
        "count": len(devices),
        "new_state": target_state
    }


# --- Monitoring Endpoints ---

@app.get("/states", response_model=Dict[str, int], tags=["Monitoring"])
def get_all_states(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Returns the current cached states of all devices."""
    # We only return states for devices registered in the DB
    devices = db.query(Device).all()
    return {d.id: device_states.get(d.id, 0) for d in devices}


# --- New Logging Endpoints ---

@app.get("/logs", response_model=List[StateLogEntry], tags=["Monitoring"])
def get_state_logs(
    limit: int = Query(default=50, le=500, description="Max entries to return"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the most recent periodic state snapshots, newest first.
    Each entry contains a full JSON snapshot of all device states at that moment.
    """
    rows = (
        db.query(StateLog)
        .order_by(StateLog.logged_at.desc())
        .limit(limit)
        .all()
    )
    return [
        StateLogEntry(id=r.id, logged_at=r.logged_at, snapshot=json.loads(r.snapshot))
        for r in rows
    ]


@app.post("/logs/trigger", tags=["Monitoring"])
def trigger_log_now(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Manually triggers an immediate state snapshot outside the normal schedule.
    Useful for testing or capturing state on demand.
    """
    log_device_states()
    latest = db.query(StateLog).order_by(StateLog.logged_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=500, detail="Logging failed")
    return {
        "message": "Snapshot captured",
        "logged_at": latest.logged_at.isoformat(),
        "snapshot": json.loads(latest.snapshot),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
