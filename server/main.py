from contextlib import asynccontextmanager

from fastapi import FastAPI

from config import LOG_INTERVAL_MINUTES
from database import Device, SessionLocal
from mqtt import mqtt_client
from routers import admin, auth, control, monitoring, schedules
from scheduler import scheduler
from users_db import init_users_db

INITIAL_DEVICES = [
    "r1/l1",
    "r1/l2",
    "r1/l3",
    "r1/l4",
    "r1/l5",
    "r1/l6",
    "r1/f1",
    "r1/f2",
    "r2/l1",
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

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(control.router)
app.include_router(monitoring.router)
app.include_router(schedules.router)
