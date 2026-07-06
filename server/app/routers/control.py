from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import can_access_room, get_current_user, get_room_from_device, require_admin
from ..database import Device, get_db, save_device_state
from ..mqtt import mqtt_client
from ..schemas import ToggleResponse
from ..state import device_states

router = APIRouter(tags=["Control"])


def _device_type(device_id: str) -> Optional[str]:
    parts = device_id.split("/")
    return parts[1][0] if len(parts) >= 2 and parts[1] else None


def _set_devices(devices: List[Device], state: int, db: Session = None) -> int:
    for device in devices:
        device_states[device.id] = state
        mqtt_client.publish(device.id, str(state), qos=1, retain=True)
        if db:
            save_device_state(db, device.id, state)
    return len(devices)


@router.post("/toggle/{device_id:path}", response_model=ToggleResponse)
def toggle_device(
    device_id: str,
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

    old_state = device_states.get(device_id, 0)
    new_state = 0 if old_state else 1
    print(f"[{current_user['username']}] toggle {device_id}: {'ON' if old_state else 'OFF'} → {'ON' if new_state else 'OFF'}")
    device_states[device_id] = new_state
    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)
    print(f"MQTT → {device_id} = {'ON' if new_state else 'OFF'}")
    save_device_state(db, device_id, new_state)
    return {"id": device_id, "new_state": new_state}


@router.post("/toggle-all")
def toggle_all(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    devices = db.query(Device).all()
    if not devices:
        return {"message": "No devices to toggle"}

    any_off = any(device_states.get(d.id, 0) == 0 for d in devices)
    target_state = 1 if any_off else 0
    print(f"[{current_user['username']}] toggle-all → {'ON' if target_state else 'OFF'} ({len(devices)} devices)")
    for device in devices:
        device_states[device.id] = target_state
        mqtt_client.publish(device.id, str(target_state), qos=1, retain=True)
        save_device_state(db, device.id, target_state)

    return {"message": f"All devices set to {target_state}", "count": len(devices), "new_state": target_state}


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
