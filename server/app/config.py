import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 9001))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TLS = os.getenv("MQTT_TLS", "false").lower() == "true"
MQTT_TRANSPORT = os.getenv("MQTT_TRANSPORT", "websockets")
MQTT_SYNC_TOPIC = os.getenv("MQTT_SYNC_TOPIC", "esp/sync")
LOG_INTERVAL_MINUTES = int(os.getenv("LOG_INTERVAL_MINUTES", 5))

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

# Maps every device ID to the MQTT topic published on toggle.
# Grouped devices share the same topic (e.g. r3:5:6/f1 controls r3, r5, r6 fans together).
# Standalone devices map to themselves.
DEVICE_TOPIC_MAP: dict[str, str] = {
    "r1/l1": "r1/l1",
    "r2/l1": "r2/l1",
    "r3/l1": "r3/l1",
    "r4/l1": "r4/l1",
    "r5/l1": "r5/l1",
    "r6/l1": "r6/l1",
    "r1/f1": "r1/f1",
    "r2/f1": "r2/f1",
    "r3/f1": "r3:5:6/f1",
    "r4/f1": "r4/f1",
    "r5/f1": "r3:5:6/f1",
    "r6/f1": "r3:5:6/f1",
}

OTA_FIRMWARE_DIR = os.getenv("OTA_FIRMWARE_DIR", "firmware")
SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "http://localhost:8000")
