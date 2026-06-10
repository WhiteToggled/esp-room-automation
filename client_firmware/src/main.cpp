#include <Arduino.h>
#include <PubSubClient.h>

#include "config.h"
#include "wifi.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

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
    state = !state;
    if (strcmp(topic, TOPIC_INPUT_1) == 0) {
        digitalWrite(PIN_INPUT_1, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_2) == 0) {
        digitalWrite(PIN_INPUT_2, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_3) == 0) {
        digitalWrite(PIN_INPUT_3, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_4) == 0) {
        digitalWrite(PIN_INPUT_4, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_5) == 0) {
        digitalWrite(PIN_INPUT_5, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_6) == 0) {
        digitalWrite(PIN_INPUT_6, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_7) == 0) {
        digitalWrite(PIN_INPUT_7, state);
    } 
    else if (strcmp(topic, TOPIC_INPUT_8) == 0) {
        digitalWrite(PIN_INPUT_8, state);
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

  pinMode(PIN_INPUT_1, OUTPUT);
  pinMode(PIN_INPUT_2, OUTPUT);
  pinMode(PIN_INPUT_3, OUTPUT);
  pinMode(PIN_INPUT_4, OUTPUT);
  pinMode(PIN_INPUT_5, OUTPUT);
  pinMode(PIN_INPUT_6, OUTPUT);
  pinMode(PIN_INPUT_7, OUTPUT);
  pinMode(PIN_INPUT_8, OUTPUT);
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // disable brownout

  pinMode(2, OUTPUT);

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