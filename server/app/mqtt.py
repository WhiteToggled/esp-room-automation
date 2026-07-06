import ssl

import paho.mqtt.client as mqtt

from .config import MQTT_BROKER, MQTT_PASSWORD, MQTT_PORT, MQTT_TLS, MQTT_USER
from .database import SessionLocal, save_device_state
from .state import device_states


def _on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print(f"MQTT connected to broker, subscribed to all topics")
        client.subscribe("#")
    else:
        print(f"MQTT connect failed (rc={rc})")


def _on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        if payload in ["0", "1"]:
            state = int(payload)
            print(f"MQTT ← {msg.topic} = {'ON' if state else 'OFF'}")
            device_states[msg.topic] = state
            db = SessionLocal()
            try:
                save_device_state(db, msg.topic, state)
            finally:
                db.close()
    except Exception as e:
        print(f"MQTT error on {msg.topic}: {e}")


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = _on_connect
mqtt_client.on_message = _on_message

if MQTT_USER and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

if MQTT_TLS:
    mqtt_client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT broker: {e}")
