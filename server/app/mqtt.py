import ssl

import paho.mqtt.client as mqtt

from .config import (
    MQTT_BROKER,
    MQTT_PASSWORD,
    MQTT_PORT,
    MQTT_SYNC_TOPIC,
    MQTT_TLS,
    MQTT_USER,
)
from .database import SessionLocal, save_device_state
from .state import device_states, group_to_devices


def _on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print(
            f"MQTT connected to broker, subscribed to all topics and {MQTT_SYNC_TOPIC}"
        )
        client.subscribe("#")
        client.subscribe(MQTT_SYNC_TOPIC)
    else:
        print(f"MQTT connect failed (rc={rc})")


def _apply_state(topic: str, state: int) -> None:
    """Persist state for an MQTT topic, resolving group membership if applicable."""
    targets = group_to_devices.get(topic)
    if targets:
        db = SessionLocal()
        try:
            for device_id in targets:
                device_states[device_id] = state
                save_device_state(db, device_id, state)
        finally:
            db.close()
    else:
        device_states[topic] = state
        db = SessionLocal()
        try:
            save_device_state(db, topic, state)
        finally:
            db.close()


def _on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        if msg.topic == MQTT_SYNC_TOPIC:
            # ESP reports state as: "r3:5:6/f1=0"
            # The left side is the full MQTT topic (may be a group topic like r3:5:6/f1)
            # which maps to device IDs like r3/f1 via group_to_devices.
            mqtt_topic, _, raw_state = payload.partition("=")
            mqtt_topic = mqtt_topic.strip()
            raw_state = raw_state.strip()
            if raw_state in ("0", "1"):
                state = int(raw_state)
                print(f"MQTT sync ← {mqtt_topic} = {'ON' if state else 'OFF'}")
                _apply_state(mqtt_topic, state)
            else:
                print(f"MQTT sync bad payload on {MQTT_SYNC_TOPIC}: {payload!r}")
        else:
            clean_payload = payload.strip()
            if clean_payload in ("0", "1"):
                state = int(clean_payload)
                print(f"MQTT ← {msg.topic} = {'ON' if state else 'OFF'}")
                _apply_state(msg.topic, state)
    except Exception as e:
        print(f"MQTT error on {msg.topic}: {e}")


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = _on_connect
mqtt_client.on_message = _on_message

if MQTT_USER and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

if MQTT_TLS:
    mqtt_client.tls_set(
        cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT
    )

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT broker: {e}")
