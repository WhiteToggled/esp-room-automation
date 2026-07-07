from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, LOG_INTERVAL_MINUTES
from .database import Device, DeviceState, RoomName, SessionLocal
from .state import device_states, room_names
from .mqtt import mqtt_client
from .routers import admin, auth, control, monitoring, ota, schedules
from .scheduler import scheduler
from .users_db import init_users_db
from .auth import get_room_from_device

INITIAL_DEVICES = [
    "r1/l1",
    "r2/l1",
    "r3/l1",
    "r4/l1",
    "r5/l1",
    "r6/l1",
    "r1/f1",
    "r2/f1",
    "r3/f1",
    "r4/f1",
    "r5/f1",
    "r6/f1",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        desired = set(INITIAL_DEVICES)
        existing = {d.id for d in db.query(Device).all()}
        for name in desired - existing:
            db.add(Device(id=name))
        for name in existing - desired:
            db.query(Device).filter(Device.id == name).delete()
        db.commit()
        for ds in db.query(DeviceState).all():
            device_states[ds.device_id] = ds.state

        all_room_ids = {get_room_from_device(did) for did in desired if get_room_from_device(did)}
        existing_room_names = {rn.room_id for rn in db.query(RoomName).all()}
        for room_id in all_room_ids:
            if room_id not in existing_room_names:
                db.add(RoomName(room_id=room_id, name=room_id))
        db.commit()
        for rn in db.query(RoomName).all():
            room_names[rn.room_id] = rn.name
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


app = FastAPI(
    title="ESP Room Automation API",
    description="Control lights and fans via MQTT and SQLCipher, with per-user lighting schedules and RBAC.",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(control.router)
app.include_router(monitoring.router)
app.include_router(schedules.router)
app.include_router(ota.router)


@app.get("/health")
def health():
    return {"status": "ok"}
