#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiManager.h>

#include "comms.h"
#include "config.h"
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"

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

    Serial.println("Boo im an updated firmware");

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
    prefs.end();

    connect_to_wifi();
    mqtt_start();
}

void loop() {
    wm.process();
    // Serial.println(digitalRead(RELAY_PINS[7]));
    // if (digitalRead(RELAY_PINS[7]) == LOW) {
    //     Serial.println("hi");
    // }
    check_reset();
    detect_switchboard();
    handle_ota_request(); // OTA arrives via MQTT but must run from here

    if (WiFi.status() != WL_CONNECTED) {
        wifi_reconnect();
    } else if (!mqtt_connected) {
        digitalWrite(STATUS_LED, HIGH);
    } else {
<<<<<<< Updated upstream
        client.loop();
    }

    if (WiFi.status() == WL_CONNECTED && client.connected()) {
=======
        digitalWrite(STATUS_LED, LOW);
>>>>>>> Stashed changes
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
        prefs.begin("relay-states", false);
        prefs.putInt(key, current);
        prefs.end();

        mqtt_pending_updates[i] = true;

        Serial.printf("Override: Switch [%s] %d\n", MQTT_TOPICS[i], !current);
    }
}

void sync_server() {
    for (int i = 0; i < N_DEVICES; ++i) {
        if (mqtt_pending_updates[i]) {
<<<<<<< Updated upstream
            mqtt_pending_updates[i] = false;

            const char *payload =
                (digitalRead(RELAY_PINS[i]) == LOW) ? "1" : "0";
            client.publish(MQTT_TOPICS[i], payload);
            Serial.printf("MQTT Publish: [%s] %s\n", MQTT_TOPICS[i], payload);
=======
            const char *state = (digitalRead(RELAY_PINS[i]) == LOW) ? "1" : "0";
            char payload[32];
            snprintf(payload, sizeof(payload), "%s=%s", MQTT_TOPICS[i], state);

            // Only clear the flag once the publish was actually accepted,
            // so a flip during a broker hiccup isn't silently lost.
            if (mqtt_publish(SYNC_SERVER_TOPIC, payload)) {
                mqtt_pending_updates[i] = false;
                Serial.printf("MQTT Publish: [%s] %s\n", SYNC_SERVER_TOPIC,
                              payload);
            }
>>>>>>> Stashed changes
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
