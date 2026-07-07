import json
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_room_from_device
from ..database import Device, StateLog, get_db
from ..scheduler import log_device_states
from ..schemas import LogBucket, StateLogEntry
from ..state import device_states, room_names

router = APIRouter(tags=["Monitoring"])

RANGE_CONFIG = {
    "day": {"span": timedelta(hours=24), "bucket": timedelta(hours=1), "buckets": 24},
    "week": {"span": timedelta(days=7), "bucket": timedelta(days=1), "buckets": 7},
    "month": {"span": timedelta(days=30), "bucket": timedelta(days=1), "buckets": 30},
}


@router.get("/states")
def get_all_states(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    devices = db.query(Device).all()
    if current_user.get("role") == "admin":
        states = {d.id: device_states.get(d.id, 0) for d in devices}
        visible_rooms = {get_room_from_device(d.id) for d in devices}
    else:
        user_rooms = set(current_user.get("rooms") or [])
        if not user_rooms:
            return {"states": {}, "names": {}}
        states = {
            d.id: device_states.get(d.id, 0)
            for d in devices
            if get_room_from_device(d.id) in user_rooms
        }
        visible_rooms = user_rooms

    names = {rid: room_names.get(rid, rid) for rid in visible_rooms if rid}
    return {"states": states, "names": names}


@router.get("/logs", response_model=List[StateLogEntry])
def get_state_logs(
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    rows = db.query(StateLog).order_by(StateLog.logged_at.desc()).limit(limit).all()
    return [
        StateLogEntry(id=r.id, logged_at=r.logged_at, snapshot=json.loads(r.snapshot))
        for r in rows
    ]


@router.get("/logs/range", response_model=List[LogBucket])
def get_log_range(
    period: str = Query(default="week", pattern="^(day|week|month)$"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    cfg = RANGE_CONFIG[period]
    start = datetime.utcnow() - cfg["span"]
    bucket_delta: timedelta = cfg["bucket"]
    num_buckets: int = cfg["buckets"]

    rows = (
        db.query(StateLog)
        .filter(StateLog.logged_at >= start)
        .order_by(StateLog.logged_at.asc())
        .all()
    )
    total_devices = db.query(Device).count()

    bucket_starts = [start + i * bucket_delta for i in range(num_buckets)]
    counts_by_bucket: dict[int, List[int]] = {i: [] for i in range(num_buckets)}
    for row in rows:
        index = int((row.logged_at - start) / bucket_delta)
        index = max(0, min(index, num_buckets - 1))
        snapshot = json.loads(row.snapshot)
        counts_by_bucket[index].append(sum(1 for v in snapshot.values() if v))

    return [
        LogBucket(
            bucket_start=bucket_starts[i],
            avg_on=(sum(counts) / len(counts)) if counts else 0.0,
            peak_on=max(counts) if counts else 0,
            total=total_devices,
            samples=len(counts),
        )
        for i, counts in counts_by_bucket.items()
    ]


@router.post("/logs/trigger")
def trigger_log_now(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    log_device_states()
    latest = db.query(StateLog).order_by(StateLog.logged_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=500, detail="Logging failed")
    return {
        "message": "Snapshot captured",
        "logged_at": latest.logged_at.isoformat(),
        "snapshot": json.loads(latest.snapshot),
    }
