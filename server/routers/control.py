from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import can_access_room, get_current_user, get_room_from_device, require_admin
from database import Device, get_db
from mqtt import mqtt_client
from schemas import ToggleResponse
from state import device_states

router = APIRouter(tags=["Control"])


def _device_type(device_id: str) -> Optional[str]:
    """Returns the type prefix of the device (e.g. 'l' for lights, 'f' for fans)."""
    parts = device_id.split("/")
    return parts[1][0] if len(parts) >= 2 and parts[1] else None


def _set_devices(devices: List[Device], state: int) -> int:
    for device in devices:
        device_states[device.id] = state
        mqtt_client.publish(device.id, str(state), qos=1, retain=True)
    return len(devices)


@router.post("/toggle/{device_id:path}", response_model=ToggleResponse)
def toggle_device(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Toggle a device. Users may only control devices in their assigned room(s)."""
    room = get_room_from_device(device_id)
    if room and not can_access_room(current_user, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: room '{room}' is not in your assigned rooms",
        )
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    new_state = 0 if device_states.get(device_id, 0) else 1
    device_states[device_id] = new_state
    mqtt_client.publish(device_id, str(new_state), qos=1, retain=True)
    return {"id": device_id, "new_state": new_state}


@router.post("/toggle-all")
def toggle_all(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Toggle all registered devices. Admin only."""
    devices = db.query(Device).all()
    if not devices:
        return {"message": "No devices to toggle"}

    any_off = any(device_states.get(d.id, 0) == 0 for d in devices)
    target_state = 1 if any_off else 0
    for device in devices:
        device_states[device.id] = target_state
        mqtt_client.publish(device.id, str(target_state), qos=1, retain=True)

    return {"message": f"All devices set to {target_state}", "count": len(devices), "new_state": target_state}


@router.post("/lights/on")
def lights_on(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Turn on all light devices. Admin only."""
    lights = [d for d in db.query(Device).all() if _device_type(d.id) == "l"]
    count = _set_devices(lights, 1)
    return {"message": "All lights turned on", "count": count}


@router.post("/fans/on")
def fans_on(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Turn on all fan devices. Admin only."""
    fans = [d for d in db.query(Device).all() if _device_type(d.id) == "f"]
    count = _set_devices(fans, 1)
    return {"message": "All fans turned on", "count": count}


@router.post("/all/off")
def all_off(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Turn off all devices. Admin only."""
    devices = db.query(Device).all()
    count = _set_devices(devices, 0)
    return {"message": "All devices turned off", "count": count}
