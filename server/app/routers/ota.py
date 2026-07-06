import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from ..auth import require_admin
from ..config import OTA_FIRMWARE_DIR, SERVER_BASE_URL
from ..mqtt import mqtt_client

router = APIRouter(prefix="/ota", tags=["OTA"])

VALID_DEVICES = {1, 2}


def _firmware_path(device: int) -> str:
    return os.path.join(OTA_FIRMWARE_DIR, f"firmware_{device}.bin")


def _ota_topic(device: int) -> str:
    return f"nestboard/firmware/update/{device}"


def _validate_device(device: int):
    if device not in VALID_DEVICES:
        raise HTTPException(status_code=400, detail="Device must be 1 or 2")


@router.post("/firmware/{device}", status_code=200)
async def upload_firmware(
    device: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin),
):
    _validate_device(device)

    if not file.filename.endswith(".bin"):
        raise HTTPException(status_code=400, detail="Only .bin files are accepted")

    os.makedirs(OTA_FIRMWARE_DIR, exist_ok=True)
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    with open(_firmware_path(device), "wb") as f:
        f.write(contents)

    print(f"OTA device {device}: firmware uploaded ({len(contents)} bytes)")
    return {
        "message": f"Firmware saved for device {device}",
        "size_bytes": len(contents),
        "md5": hashlib.md5(contents).hexdigest(),
    }


@router.post("/trigger/{device}", status_code=200)
async def trigger_update(
    device: int,
    current_user: dict = Depends(require_admin),
):
    _validate_device(device)

    if not os.path.exists(_firmware_path(device)):
        raise HTTPException(status_code=404, detail=f"No firmware uploaded for device {device}")

    firmware_url = f"{SERVER_BASE_URL.rstrip('/')}/ota/firmware/{device}"
    topic = _ota_topic(device)
    print(f"OTA device {device}: trigger → {topic}")
    mqtt_client.publish(topic, firmware_url)

    return {
        "message": f"Firmware URL published for device {device}",
        "topic": topic,
        "url": firmware_url,
    }


@router.get("/firmware/{device}")
async def download_firmware(device: int):
    _validate_device(device)

    path = _firmware_path(device)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"No firmware available for device {device}")

    return FileResponse(path, media_type="application/octet-stream", filename=f"firmware_{device}.bin")
