#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiManager.h>

#include "comms.h"
#include "config.h"

extern PubSubClient client;
Preferences prefs;

char mqtt_server[40] = "";
char mqtt_port[6] = "1883";
char mqtt_client_id[40] = "ESP32_Nestboard";
bool update_config = false;

void update_cfg_callback() { update_config = true; }

void connect_to_wifi() {
    prefs.begin("nestboard-cfg", false);

    String pref_server = prefs.getString("mq_server", "");
    String pref_port = prefs.getString("mq_port", "1883");
    String pref_client_id = prefs.getString("mq_id", "ESP32_Nestboard");

    strcpy(mqtt_server, pref_server.c_str());
    strcpy(mqtt_port, pref_port.c_str());
    strcpy(mqtt_client_id, pref_client_id.c_str());

    WiFiManager wm;
    wm.setSaveConfigCallback(update_cfg_callback);

    WiFiManagerParameter param_mqtt_server("server", "MQTT Server IP", mqtt_server, 40);
    WiFiManagerParameter param_mqtt_port("port", "MQTT Port", mqtt_port, 6);
    WiFiManagerParameter param_mqtt_id("client_id", "MQTT Client ID",
                                       mqtt_client_id, 40);

    wm.addParameter(&param_mqtt_server);
    wm.addParameter(&param_mqtt_port);
    wm.addParameter(&param_mqtt_id);

    Serial.print("Starting WiFi Manager ..");
    digitalWrite(STATUS_LED, HIGH);

    if (!wm.autoConnect("Nestboard-Setup")) {
        Serial.println("Config Portal timeout or failure. Restarting...");
        delay(3000);
        ESP.restart();
    }

    digitalWrite(STATUS_LED, LOW);
    Serial.println("\nConncted to wifi! Assigned IP Address : ");
    Serial.println(WiFi.localIP());

    if (update_config) {
        strcpy(mqtt_server, param_mqtt_server.getValue());
        strcpy(mqtt_port, param_mqtt_port.getValue());
        strcpy(mqtt_client_id, param_mqtt_id.getValue());

        prefs.putString("mq_server", String(mqtt_server));
        prefs.putString("mq_port", String(mqtt_port));
        prefs.putString("mq_id", String(mqtt_client_id));
        Serial.println("Updated Configuration!");
    }
    prefs.end();
}

void wifi_reconnect() {
    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000)
        return;
    lastAttempt = now;

    Serial.println("WiFi lost, reconnecting..");
    WiFi.disconnect();
    WiFi.reconnect();
}

void mqtt_reconnect() {
    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 5000)
        return;
    lastAttempt = now;

    Serial.print("MQTT connection lost, reconnecting...");
    if (client.connect(mqtt_client_id)) {
        Serial.println("MQTT Connected!");
        client.subscribe("#");
    } else {
        Serial.printf("MQTT Failed, rc=%d. Try again in 5 seconds.\n",
                      client.state());
    }
}

// -------------- MQTT --------------

void callback(char *topic, byte *payload, unsigned int length) {
    char message[256];
    if (length > 255)
        length = 255;
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
