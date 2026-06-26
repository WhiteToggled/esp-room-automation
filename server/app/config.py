import os
from dotenv import load_dotenv

load_dotenv()

DB_PASSPHRASE = os.environ["DB_PASSPHRASE"]
DATA_DIR = os.getenv("DATA_DIR", ".")
DATABASE_URL = f"sqlite+pysqlcipher://:{DB_PASSPHRASE}@/{DATA_DIR}/automation.db"

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
LOG_INTERVAL_MINUTES = int(os.getenv("LOG_INTERVAL_MINUTES", 5))

SECRET_KEY = os.environ["JWT_SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
