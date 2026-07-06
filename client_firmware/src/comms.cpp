#include <HTTPUpdate.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>

#include "comms.h"
#include "config.h"

WiFiClientSecure espClient;
PubSubClient client(espClient);
WiFiManager wm;
Preferences prefs;

char mqtt_username[64] = "test";
char mqtt_pass[32] = "testtest";
char mqtt_server[128] = "8d05a36cd6004e98b1164a0f2d05cbba.s1.eu.hivemq.cloud";
char mqtt_port[6] = "8883";
char mqtt_client_id[64] = "ESP32_Nestboard";
bool update_config = false;

WiFiManagerParameter param_mqtt_user("username", "MQTT Username", mqtt_username,
                                     64);
WiFiManagerParameter param_mqtt_pass("password", "MQTT Password", mqtt_pass,
                                     32);
WiFiManagerParameter param_mqtt_server("server", "MQTT Server IP", mqtt_server,
                                       128);
WiFiManagerParameter param_mqtt_port("port", "MQTT Port", mqtt_port, 6);
WiFiManagerParameter param_mqtt_id("client_id", "MQTT Client ID",
                                   mqtt_client_id, 64);

void update_cfg_callback() { update_config = true; }

void connect_to_wifi() {
    prefs.begin("nestboard-cfg", false);

    String pref_username = prefs.getString("mq_user", "test");
    String pref_pass = prefs.getString("mq_pass", "testtest");
    String pref_server = prefs.getString(
        "mq_server", "8d05a36cd6004e98b1164a0f2d05cbba.s1.eu.hivemq.cloud");
    String pref_port = prefs.getString("mq_port", "8883");
    String pref_client_id = prefs.getString("mq_id", "ESP32_Nestboard");

    strcpy(mqtt_username, pref_username.c_str());
    strcpy(mqtt_pass, pref_pass.c_str());
    strcpy(mqtt_server, pref_server.c_str());
    strcpy(mqtt_port, pref_port.c_str());
    strcpy(mqtt_client_id, pref_client_id.c_str());

    wm.setConfigPortalBlocking(false);
    wm.setSaveConfigCallback(update_cfg_callback);
    wm.setConnectTimeout(10);

    wm.addParameter(&param_mqtt_user);
    wm.addParameter(&param_mqtt_pass);
    wm.addParameter(&param_mqtt_server);
    wm.addParameter(&param_mqtt_port);
    wm.addParameter(&param_mqtt_id);

    Serial.print("Starting WiFi Manager ..");
    digitalWrite(STATUS_LED, HIGH);

    if (!wm.autoConnect("Nestboard-Setup")) {
        Serial.println(
            "Config Portal timeout or failure. Starting offline ...");
        digitalWrite(STATUS_LED, LOW);
        return;
    }

    digitalWrite(STATUS_LED, LOW);
    Serial.println("\nConncted to wifi! Assigned IP Address : ");
    Serial.println(WiFi.localIP());

    if (update_config) {
        strcpy(mqtt_username, param_mqtt_user.getValue());
        strcpy(mqtt_pass, param_mqtt_pass.getValue());
        strcpy(mqtt_server, param_mqtt_server.getValue());
        strcpy(mqtt_port, param_mqtt_port.getValue());
        strcpy(mqtt_client_id, param_mqtt_id.getValue());

        prefs.putString("mq_user", String(mqtt_username));
        prefs.putString("mq_pass", String(mqtt_pass));
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

    if (client.connect(mqtt_client_id, mqtt_username, mqtt_pass)) {
        Serial.println("MQTT Connected!");
        for (int i = 0; i < N_DEVICES; i++) {
            client.subscribe(MQTT_TOPICS[i]);
        }
        client.subscribe(FIRMWARE_UPDATE_TOPIC);
    } else {
        Serial.printf("MQTT Failed, rc=%d. Try again in 5 seconds.\n",
                      client.state());
    }
}

// -------------- MQTT --------------
void update_ota(const char* url) {
    Serial.printf("Starting OTA update from URL: %s\n", url);

    client.disconnect();

    WiFiClientSecure updateClient;
    updateClient.setInsecure();
    t_httpUpdate_return ret = httpUpdate.update(updateClient, url);
    switch (ret) {
    case HTTP_UPDATE_FAILED:
        Serial.printf("OTA Failed (%d): %s\n", httpUpdate.getLastError(),
                      httpUpdate.getLastErrorString().c_str());
        break;
    case HTTP_UPDATE_NO_UPDATES:
        Serial.println("No new updates available.");
        break;
    case HTTP_UPDATE_OK:
        Serial.println("OTA Successful! Rebooting...");
        // The ESP32 usually restarts automatically on success, but just in
        // case:
        ESP.restart();
        break;
    }
    return;
}

void callback(char *topic, byte *payload, unsigned int length) {
    char message[256];
    if (length > 255)
        length = 255;
    memcpy(message, payload, length);
    message[length] = '\0';
    Serial.printf("Message arrived: [%s] %s\n", topic, message);

    if (strcmp(topic, FIRMWARE_UPDATE_TOPIC) == 0) {
        update_ota(message);
        return;
    }

    int target_state = atoi(message);
    target_state = !target_state;
    for (int i = 0; i < N_DEVICES; ++i) {
        if (strcmp(topic, MQTT_TOPICS[i]) == 0) {
            if (digitalRead(RELAY_PINS[i]) == target_state)
                break;

            digitalWrite(RELAY_PINS[i], target_state);
            // save to memory
            prefs.begin("relay-states", false);
            char key[4];
            snprintf(key, sizeof(key), "r%d", i + 1);
            prefs.putInt(key, target_state);
            prefs.end();
        }
    }
}
