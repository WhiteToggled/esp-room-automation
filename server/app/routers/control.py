from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth import can_access_room, get_current_user, get_room_from_device, require_admin
from ..database import Device, get_db, save_device_state
from ..mqtt import mqtt_client
from ..schemas import SetResponse
from ..state import device_states, device_to_group, group_to_devices

router = APIRouter(tags=["Control"])


def _device_type(device_id: str) -> Optional[str]:
    parts = device_id.split("/")
    return parts[1][0] if len(parts) >= 2 and parts[1] else None


def _publish_state(device_id: str, state: int, db: Session = None) -> List[str]:
    """Publish state for a device. Returns all affected device IDs."""
    group_topic = device_to_group.get(device_id)
    if group_topic:
        members = group_to_devices.get(group_topic, [device_id])
        mqtt_client.publish(group_topic, str(state), qos=1, retain=True)
        for member in members:
            device_states[member] = state
            if db:
                save_device_state(db, member, state)
        return members
    else:
        device_states[device_id] = state
        mqtt_client.publish(device_id, str(state), qos=1, retain=True)
        if db:
            save_device_state(db, device_id, state)
        return [device_id]


def _set_devices(devices: List[Device], state: int, db: Session = None) -> int:
    published_topics: set = set()
    for device in devices:
        group_topic = device_to_group.get(device.id)
        if group_topic:
            if group_topic not in published_topics:
                mqtt_client.publish(group_topic, str(state), qos=1, retain=True)
                published_topics.add(group_topic)
            for member in group_to_devices.get(group_topic, [device.id]):
                device_states[member] = state
                if db:
                    save_device_state(db, member, state)
        else:
            device_states[device.id] = state
            mqtt_client.publish(device.id, str(state), qos=1, retain=True)
            if db:
                save_device_state(db, device.id, state)
    return len(devices)


@router.post("/set/{device_id:path}", response_model=SetResponse)
def set_device(
    device_id: str,
    state: int = Query(..., ge=0, le=1),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    room = get_room_from_device(device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: room '{room}' is not in your assigned rooms",
        )
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    print(f"[{current_user['username']}] set {device_id} → {'ON' if state else 'OFF'}")
    affected = _publish_state(device_id, state, db)
    print(f"MQTT → {device_to_group.get(device_id, device_id)} = {'ON' if state else 'OFF'}")
    return {"id": device_id, "new_state": state, "affected_ids": affected}


@router.post("/set-all")
def set_all(
    state: int = Query(..., ge=0, le=1),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    devices = db.query(Device).all()
    if not devices:
        return {"message": "No devices found"}

    print(f"[{current_user['username']}] set-all → {'ON' if state else 'OFF'} ({len(devices)} devices)")
    count = _set_devices(devices, state, db)
    return {"message": f"All devices set to {state}", "count": count, "new_state": state}


@router.post("/lights/on")
def lights_on(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    lights = [d for d in db.query(Device).all() if _device_type(d.id) == "l"]
    print(f"[{current_user['username']}] lights on ({len(lights)} devices)")
    count = _set_devices(lights, 1, db)
    return {"message": "All lights turned on", "count": count}


@router.post("/fans/on")
def fans_on(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    fans = [d for d in db.query(Device).all() if _device_type(d.id) == "f"]
    print(f"[{current_user['username']}] fans on ({len(fans)} devices)")
    count = _set_devices(fans, 1, db)
    return {"message": "All fans turned on", "count": count}


@router.post("/all/off")
def all_off(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    devices = db.query(Device).all()
    print(f"[{current_user['username']}] all off ({len(devices)} devices)")
    count = _set_devices(devices, 0, db)
    return {"message": "All devices turned off", "count": count}
