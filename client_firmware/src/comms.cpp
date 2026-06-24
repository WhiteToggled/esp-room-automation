#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include "config.h"
#include "comms.h"

// ------------------- WIFI -------------------

void connect_to_wifi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    while (WiFi.status() != WL_CONNECTED) {
        digitalWrite(STATUS_LED, HIGH);
        delay(250);
        digitalWrite(STATUS_LED, LOW);
        delay(250);
        Serial.print(".");
    }

    digitalWrite(STATUS_LED, LOW);
    Serial.println("\nConncted to wifi! Assigned IP Address : ");
    Serial.println(WiFi.localIP());
}

void wifi_reconnect() {
    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000)
        return;
    lastAttempt = now;

    Serial.println("WiFi lost, reconnecting..");
    WiFi.reconnect();
}

// -------------- MQTT --------------
extern PubSubClient client;

void callback(char *topic, byte *payload, unsigned int length) {
    char message[256];
    memcpy(message, payload, length);
    message[length] = '\0';
    Serial.printf("Message arrived: [%s] %s\n", topic, message);

    int target_state = atoi(message);
    target_state = !target_state;
    for (int i = 0; i < 8; ++i) {
        if (strcmp(topic, MQTT_TOPICS[i]) == 0) {
            digitalWrite(RELAY_PINS[i], target_state);
        }
    }
}

void mqtt_reconnect() {
    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000)
        return;
    lastAttempt = now;

    Serial.print("MQTT connection lost, reconnecting...");
    if (client.connect(MQTT_CLIENT_ID)) {
        Serial.println("MQTT Connected!");
        client.subscribe("#");
    } else {
        Serial.printf("MQTT Failed, rc=%d. Try again in 5 seconds.\n",
                      client.state());
    }
}
