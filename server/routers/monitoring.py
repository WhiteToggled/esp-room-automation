import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth import get_current_user, get_room_from_device
from database import Device, StateLog, get_db
from scheduler import log_device_states
from schemas import StateLogEntry
from state import device_states

router = APIRouter(tags=["Monitoring"])


@router.get("/states")
def get_all_states(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Admin sees all devices; users see only their assigned room(s)."""
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


@router.get("/logs", response_model=List[StateLogEntry])
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


@router.post("/logs/trigger")
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
