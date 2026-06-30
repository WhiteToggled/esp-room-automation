import json
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from .config import LOG_INTERVAL_MINUTES
from .database import Schedule, SessionLocal, StateLog, Device
from .mqtt import mqtt_client
from .state import device_states


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


def run_scheduled_actions():
    now = datetime.now()
    current_day = now.strftime("%a").lower()

    db = SessionLocal()
    try:
        due = (
            db.query(Schedule)
            .filter(
                Schedule.enabled == 1,
                Schedule.hour == now.hour,
                Schedule.minute == now.minute,
            )
            .all()
        )
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
