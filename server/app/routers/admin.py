from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, pwd_context, require_admin
from ..database import DeviceGroup, RoomName, get_db
from ..schemas import DeviceGroupCreate, DeviceGroupResponse, RenameRoomRequest, UserCreate, UserRoomsUpdate
from ..state import device_to_group, group_to_devices, room_names
from ..users_db import (
    get_persisted_user,
    list_all_users,
    persist_user,
    remove_user,
    update_user_rooms,
)

router = APIRouter(tags=["Admin"])


@router.post("/users", status_code=201)
def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_admin),
):
    uname = user_data.username.strip()
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(user_data.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    if get_persisted_user(uname) is not None:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = pwd_context.hash(user_data.password)
    try:
        persist_user(uname, hashed, role="user", rooms=user_data.rooms)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not create user: {e}")

    return {"username": uname, "role": "user", "rooms": user_data.rooms}


@router.get("/users")
def list_users(current_user: dict = Depends(require_admin)):
    return list_all_users()


@router.put("/users/{username}/rooms")
def assign_user_rooms(
    username: str,
    data: UserRoomsUpdate,
    current_user: dict = Depends(require_admin),
):
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    if not update_user_rooms(username, data.rooms):
        raise HTTPException(status_code=500, detail="Failed to update rooms")
    return {"username": username, "rooms": data.rooms}


@router.delete("/users/{username}")
def delete_user(
    username: str,
    current_user: dict = Depends(require_admin),
):
    if not get_persisted_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    remove_user(username)
    return {"message": f"User '{username}' deleted"}


@router.get("/rooms")
def list_rooms(current_user: dict = Depends(require_admin)):
    return [{"room_id": rid, "name": name} for rid, name in sorted(room_names.items())]


@router.put("/rooms/{room_id}")
def rename_room(
    room_id: str,
    data: RenameRoomRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    if room_id not in room_names:
        raise HTTPException(status_code=404, detail=f"Room '{room_id}' not found")
    if current_user["role"] != "admin" and room_id not in (current_user.get("rooms") or []):
        raise HTTPException(status_code=403, detail=f"Access denied: room '{room_id}' is not in your assigned rooms")

    db_entry = db.query(RoomName).filter(RoomName.room_id == room_id).first()
    if db_entry:
        db_entry.name = name
    else:
        db.add(RoomName(room_id=room_id, name=name))
    db.commit()
    room_names[room_id] = name
    return {"room_id": room_id, "name": name}


def _group_to_response(g: DeviceGroup) -> DeviceGroupResponse:
    return DeviceGroupResponse(
        id=g.id,
        mqtt_topic=g.mqtt_topic,
        device_ids=[d.strip() for d in g.device_ids.split(",") if d.strip()],
    )


@router.get("/groups", response_model=list[DeviceGroupResponse])
def list_groups(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return [_group_to_response(g) for g in db.query(DeviceGroup).order_by(DeviceGroup.id).all()]


@router.post("/groups", response_model=DeviceGroupResponse, status_code=201)
def create_group(
    data: DeviceGroupCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    if db.query(DeviceGroup).filter(DeviceGroup.mqtt_topic == data.mqtt_topic).first():
        raise HTTPException(status_code=400, detail=f"Group with topic '{data.mqtt_topic}' already exists")

    already_grouped = [d for d in data.device_ids if d in device_to_group]
    if already_grouped:
        raise HTTPException(status_code=400, detail=f"Devices already in a group: {already_grouped}")

    g = DeviceGroup(mqtt_topic=data.mqtt_topic, device_ids=",".join(data.device_ids))
    db.add(g)
    db.commit()
    db.refresh(g)

    group_to_devices[g.mqtt_topic] = list(data.device_ids)
    for device_id in data.device_ids:
        device_to_group[device_id] = g.mqtt_topic

    return _group_to_response(g)


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    g = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    members = group_to_devices.pop(g.mqtt_topic, [])
    for device_id in members:
        device_to_group.pop(device_id, None)

    db.delete(g)
    db.commit()
    return {"message": f"Group {group_id} deleted", "mqtt_topic": g.mqtt_topic}
