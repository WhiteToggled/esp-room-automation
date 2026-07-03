#include <Arduino.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiManager.h>

#include "comms.h"
#include "config.h"
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"

WiFiClient espClient;
extern Preferences prefs;
PubSubClient client(espClient);

//  ----- VARIABLES -----------

bool last_switch_state[N_DEVICES];
unsigned long debounce_time[N_DEVICES];
bool mqtt_pending_updates[N_DEVICES] = {false};

void check_reset();
void detect_switchboard();
void sync_server();
// ---------------------------

void setup() {
    Serial.begin(115200);

    pinMode(STATUS_LED, OUTPUT);
    digitalWrite(STATUS_LED, HIGH);
    pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

    prefs.begin("relay-states", false);
    for (unsigned int i = 0; i < N_DEVICES; ++i) {
        pinMode(RELAY_PINS[i], OUTPUT);

        char key[4];
        snprintf(key, sizeof(key), "r%d", i + 1);
        int stored_state = prefs.getInt(key, HIGH); // Default off
        digitalWrite(RELAY_PINS[i], stored_state);
        Serial.printf("Stored %s, %d -- ", key, stored_state);

        pinMode(SWITCH_PINS[i], INPUT_PULLUP);
        last_switch_state[i] = digitalRead(SWITCH_PINS[i]);
        debounce_time[i] = 0;
    }
    Serial.println();

    connect_to_wifi();

    client.setServer(mqtt_server, atoi(mqtt_port));
    client.setCallback(callback);
}

void loop() {
    // Serial.println(digitalRead(RELAY_PINS[7]));
    // if (digitalRead(RELAY_PINS[7]) == LOW) {
    //     Serial.println("hi");
    // }
    check_reset();
    detect_switchboard();
    if (WiFi.status() != WL_CONNECTED) {
        wifi_reconnect();
    } else if (!client.connected()) {
        mqtt_reconnect();
    } else {
        client.loop();
    }

    if (WiFi.status() == WL_CONNECTED && client.connected()) {
        sync_server();
    }
}

void detect_switchboard() {
    static unsigned long last_scan = 0;

    if (millis() - last_scan < 5)
        return;

    last_scan = millis();

    unsigned long now = millis();

    for (int i = 0; i < N_DEVICES; i++) {
        bool current = digitalRead(SWITCH_PINS[i]);

        if (current == last_switch_state[i])
            continue;

        if (now - debounce_time[i] < DEBOUNCE_DELAY)
            continue;

        debounce_time[i] = now;
        last_switch_state[i] = current;
        digitalWrite(RELAY_PINS[i], current);

        char key[4];
        snprintf(key, sizeof(key), "r%d", i + 1);
        prefs.putInt(key, current);

        mqtt_pending_updates[i] = true;

        Serial.printf("Override: Switch [%s] %d\n", MQTT_TOPICS[i], !current);
    }
}

void sync_server() {
    for (int i = 0; i < N_DEVICES; ++i) {
        if (mqtt_pending_updates[i]) {
            mqtt_pending_updates[i] = false;

            const char *payload = (digitalRead(RELAY_PINS[i]) == LOW) ? "1" : "0";
            client.publish(MQTT_TOPICS[i], payload);
            Serial.printf("MQTT Publish: [%s] %s\n", MQTT_TOPICS[i], payload);
        }
    }
}

void check_reset() {
    if (digitalRead(BOOT_BUTTON_PIN) == LOW) {
        unsigned long start_time = millis();
        while (digitalRead(BOOT_BUTTON_PIN) == LOW) {
            digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
            delay(100);

            if (millis() - start_time > RESET_HOLD_TIME) {
                Serial.println("\n----- FACTORY RESETTING -------\n");
                WiFiManager wm;
                wm.resetSettings();

                digitalWrite(STATUS_LED, HIGH);

                prefs.begin("nestboard-cfg", false);
                prefs.clear();
                prefs.end();

                delay(2000);
                digitalWrite(STATUS_LED, LOW);

                Serial.println("\n -------- RESTARTING -------\n");
                delay(1000);
                ESP.restart();
            }
        }
        digitalWrite(STATUS_LED, LOW);
    }
}
