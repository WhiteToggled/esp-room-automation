#!/bin/sh
set -e

if [ -z "$MQTT_USER" ] || [ -z "$MQTT_PASSWORD" ]; then
    echo "ERROR: MQTT_USER and MQTT_PASSWORD must be set"
    exit 1
fi

rm -f /mosquitto/config/passwd
mosquitto_passwd -c -b /mosquitto/config/passwd "$MQTT_USER" "$MQTT_PASSWORD"
chmod 0640 /mosquitto/config/passwd
chown root:mosquitto /mosquitto/config/passwd

exec mosquitto -c /mosquitto/config/mosquitto.conf
