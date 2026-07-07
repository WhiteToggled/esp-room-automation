from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import can_access_room, get_current_user, get_room_from_device
from ..database import Device, Schedule, get_db
from ..schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(tags=["Schedules"])


def _to_response(sched: Schedule) -> ScheduleResponse:
    return ScheduleResponse(
        id=sched.id,
        device_ids=[d.strip() for d in sched.device_ids.split(",") if d.strip()],
        action=sched.action,
        hour=sched.hour,
        minute=sched.minute,
        days=[d.strip() for d in sched.days.split(",") if d.strip()],
        enabled=bool(sched.enabled),
        created_by=sched.created_by,
        created_at=sched.created_at,
    )


def _schedule_rooms(sched: Schedule) -> set[str]:
    return {
        r for did in sched.device_ids.split(",")
        if (r := get_room_from_device(did.strip()))
    }


@router.post("/schedules", response_model=ScheduleResponse, status_code=201)
def create_schedule(
    schedule: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    for device_id in schedule.device_ids:
        room = get_room_from_device(device_id)
        if not room:
            raise HTTPException(status_code=400, detail=f"Invalid device_id '{device_id}' — expected 'room/device'")
        if not can_access_room(current_user, room):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: room '{room}' is not in your assigned rooms",
            )
        if not db.query(Device).filter(Device.id == device_id).first():
            raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    sched = Schedule(
        device_ids=",".join(schedule.device_ids),
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
    print(f"[{current_user['username']}] schedule #{sched.id} created: {sched.device_ids} {'ON' if sched.action else 'OFF'} @ {sched.hour:02d}:{sched.minute:02d} [{sched.days}]")
    return _to_response(sched)


@router.get("/schedules", response_model=List[ScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("role") == "admin":
        rows = db.query(Schedule).order_by(Schedule.id).all()
    else:
        user_rooms = current_user.get("rooms") or []
        if not user_rooms:
            return []
        rows = (
            db.query(Schedule)
            .filter(or_(*[
                or_(
                    Schedule.device_ids.like(f"{r}/%"),
                    Schedule.device_ids.like(f"%,{r}/%"),
                )
                for r in user_rooms
            ]))
            .order_by(Schedule.id)
            .all()
        )
    return [_to_response(r) for r in rows]


@router.get("/schedules/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not all(can_access_room(current_user, r) for r in _schedule_rooms(sched)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return _to_response(sched)


@router.put("/schedules/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(
    schedule_id: int,
    update: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not all(can_access_room(current_user, r) for r in _schedule_rooms(sched)):
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
    return _to_response(sched)


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sched = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not all(can_access_room(current_user, r) for r in _schedule_rooms(sched)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    db.delete(sched)
    db.commit()
    print(f"[{current_user['username']}] schedule #{schedule_id} deleted ({sched.device_ids})")
    return {"message": f"Schedule {schedule_id} deleted"}
