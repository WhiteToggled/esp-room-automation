import os
import json
from typing import List, Dict
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text
from contextlib import asynccontextmanager
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import paho.mqtt.client as mqtt
from apscheduler.schedulers.background import BackgroundScheduler

# --- Configuration ---
DATABASE_URL = "sqlite:///./automation.db"
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
LOG_INTERVAL_MINUTES = int(os.getenv("LOG_INTERVAL_MINUTES", 5))

# --- Database Setup ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)  # e.g., "r1/l1", "r1/f1"
    state = Column(Integer, default=0)


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


# --- MQTT Setup ---
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)


def on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print("Connected to MQTT Broker!")
    else:
        print(f"Failed to connect, return code {rc}")


mqtt_client.on_connect = on_connect

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT broker: {e}")


# --- Cron Job: Periodic State Logger ---
def log_device_states():
    """
    Cron job that runs every LOG_INTERVAL_MINUTES minutes.
    Reads all device states and writes a JSON snapshot to the state_logs table.
    """
    db = SessionLocal()
    try:
        devices = db.query(Device).all()
        if not devices:
            return

        snapshot = {device.id: device.state for device in devices}
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
    if db.query(Device).count() == 0:
        initial_devices = ["r1/l1", "r1/l2", "r1/f1"]
        db.add_all([Device(id=name, state=0) for name in initial_devices])
        db.commit()
    db.close()

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
    description="Control lights and fans via MQTT and SQLite, with periodic state logging.",
    version="1.2.0",
    lifespan=lifespan,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Existing Endpoints ---

@app.get("/states", response_model=Dict[str, int], tags=["Monitoring"])
def get_all_states(db: Session = Depends(get_db)):
    """Returns a dictionary of all current device states."""
    devices = db.query(Device).all()
    return {device.id: device.state for device in devices}


@app.post("/toggle/{device_id:path}", response_model=ToggleResponse, tags=["Control"])
def toggle_device(device_id: str, db: Session = Depends(get_db)):
    """
    Toggles a specific device (e.g., 'r1/l1' or 'r2/f2').
    Updates SQLite and publishes the new state to the matching MQTT topic.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    new_state = 1 if device.state == 0 else 0
    device.state = new_state
    db.commit()

    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)
    return {"id": device_id, "new_state": new_state}


# --- New Logging Endpoints ---

@app.get("/logs", response_model=List[StateLogEntry], tags=["Monitoring"])
def get_state_logs(
    limit: int = Query(default=50, le=500, description="Max entries to return"),
    db: Session = Depends(get_db),
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
def trigger_log_now(db: Session = Depends(get_db)):
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
