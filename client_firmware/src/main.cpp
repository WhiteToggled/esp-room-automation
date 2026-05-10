#include <Arduino.h>
#include <PubSubClient.h>

#include "config.h"
#include "wifi.h"

WiFiClient espClient;
PubSubClient client(espClient);

void callback(char* topic, byte* payload, unsigned int length) {
    Serial.print("Message arrived [");
    Serial.print(topic);
    Serial.print("] ");

    String message = "";
    for (int i = 0; i < length; i++) {
        message += (char)payload[i];
    }
    Serial.println(message);

    int state = message.toInt();
    if (strcmp(topic, TOPIC_LIGHT_1) == 0) {
        digitalWrite(PIN_LIGHT_1, state);
    } 
    else if (strcmp(topic, TOPIC_LIGHT_2) == 0) {
        digitalWrite(PIN_LIGHT_2, state);
    } 
    else if (strcmp(topic, TOPIC_FAN_1) == 0) {
        digitalWrite(PIN_FAN_1, state);
    }
}

void reconnect() {
    // Loop until we're reconnected
    while (!client.connected()) {
        Serial.print("Attempting MQTT connection...");
        // Attempt to connect with a unique client ID
        if (client.connect("ESP32_Room1_Client")) {
            Serial.println("connected");
            // Subscribe to the room wildcard to catch all room 1 updates
            client.subscribe("r1/#");
        } else {
            Serial.print("failed, rc=");
            Serial.print(client.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}


void setup() {
  Serial.begin(115200);

  pinMode(PIN_LIGHT_1, OUTPUT);
  // pinMode(PIN_LIGHT_2, OUTPUT);
  // pinMode(PIN_FAN_1, OUTPUT);

  connect_to_wifi();

  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(callback);
}

void loop() {
    if (!client.connected()) {
        reconnect();
    }
    client.loop();
}