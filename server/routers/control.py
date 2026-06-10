from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import can_access_room, get_current_user, get_room_from_device, require_admin
from database import Device, get_db
from mqtt import mqtt_client
from schemas import ToggleResponse
from state import device_states

router = APIRouter(tags=["Control"])


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
