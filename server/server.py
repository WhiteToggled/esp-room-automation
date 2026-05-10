import os
from typing import List, Dict
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer
from contextlib import asynccontextmanager
from sqlalchemy.orm import sessionmaker, Session, declarative_base
import paho.mqtt.client as mqtt

# --- Configuration ---
DATABASE_URL = "sqlite:///./automation.db"
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))

# --- Database Setup ---
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"
    id = Column(String, primary_key=True, index=True)  # e.g., "r1/l1", "r1/f1"
    state = Column(Integer, default=0)


Base.metadata.create_all(bind=engine)


# --- Pydantic Models for Swagger ---
class ToggleResponse(BaseModel):
    id: str
    new_state: int


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


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic: Seed specific devices
    db = SessionLocal()
    if db.query(Device).count() == 0:
        # User defined devices: lights (l) and fans (f) in different rooms (r)
        initial_devices = [
            "r1/l1", "r1/l2", "r1/f1",
        ]
        devices = [Device(id=name, state=0) for name in initial_devices]
        db.add_all(devices)
        db.commit()
    db.close()
    yield
    # Shutdown logic
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

# --- FastAPI App ---
app = FastAPI(
    title="ESP Room Automation API",
    description="Control lights (r1/l1) and fans (r1/f1) via MQTT and SQLite.",
    version="1.1.0",
    lifespan=lifespan
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/states", response_model=Dict[str, int], tags=["Monitoring"])
def get_all_states(db: Session = Depends(get_db)):
    """
    Returns a dictionary of all device states.
    Example: {"r1/l1": 0, "r1/f1": 1}
    """
    devices = db.query(Device).all()
    return {device.id: device.state for device in devices}


@app.post("/toggle/{device_id:path}", response_model=ToggleResponse, tags=["Control"])
def toggle_device(device_id: str, db: Session = Depends(get_db)):
    """
    Toggles a specific device (e.g., 'r1/l1' or 'r2/f2').
    - Updates SQLite database.
    - Publishes new state to the MQTT topic matching the device ID.
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    new_state = 1 if device.state == 0 else 0
    device.state = new_state
    db.commit()

    # Publish directly to the device-specific topic
    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)

    return {"id": device_id, "new_state": new_state}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
