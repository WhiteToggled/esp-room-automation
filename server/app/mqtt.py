import paho.mqtt.client as mqtt
from .config import MQTT_BROKER, MQTT_PASSWORD, MQTT_PORT, MQTT_USER
from .state import device_states


def _on_connect(client, userdata, flags, rc, properties):
    if rc == 0:
        print("Connected to MQTT Broker!")
        client.subscribe("#")
    else:
        print(f"Failed to connect to MQTT broker, return code {rc}")


def _on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        if payload in ["0", "1"]:
            device_states[msg.topic] = int(payload)
            print(f"State updated: {msg.topic} -> {payload}")
    except Exception as e:
        print(f"Error processing MQTT message on {msg.topic}: {e}")


mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
mqtt_client.on_connect = _on_connect
mqtt_client.on_message = _on_message

if MQTT_USER and MQTT_PASSWORD:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)

try:
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
    mqtt_client.loop_start()
except Exception as e:
    print(f"Could not connect to MQTT broker: {e}")
