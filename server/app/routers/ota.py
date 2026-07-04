import hashlib
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from ..auth import require_admin
from ..config import OTA_FIRMWARE_DIR, SERVER_BASE_URL
from ..mqtt import mqtt_client

router = APIRouter(prefix="/ota", tags=["OTA"])

FIRMWARE_PATH = os.path.join(OTA_FIRMWARE_DIR, "firmware.bin")

OTA_TOPIC_UPDATE = "nestboard/firmware/update"


@router.post("/firmware", status_code=200)
async def upload_firmware(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin),
):
    if not file.filename.endswith(".bin"):
        raise HTTPException(status_code=400, detail="Only .bin files are accepted")

    os.makedirs(OTA_FIRMWARE_DIR, exist_ok=True)
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    with open(FIRMWARE_PATH, "wb") as f:
        f.write(contents)

    firmware_url = f"{SERVER_BASE_URL.rstrip('/')}/ota/firmware"
    mqtt_client.publish(OTA_TOPIC_UPDATE, firmware_url)

    return {
        "message": "Firmware URL published over MQTT",
        "url": firmware_url,
        "size_bytes": len(contents),
        "md5": hashlib.md5(contents).hexdigest(),
    }


@router.get("/firmware")
async def download_firmware():
    if not os.path.exists(FIRMWARE_PATH):
        raise HTTPException(status_code=404, detail="No firmware available")
    return FileResponse(FIRMWARE_PATH, media_type="application/octet-stream", filename="firmware.bin")
