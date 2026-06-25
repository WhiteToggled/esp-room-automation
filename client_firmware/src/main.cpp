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

volatile bool switch_pressed[8] = {false};
unsigned long switch_debounce_time[8] = {0};
bool mqtt_pending_updates[8] = {false};
bool mqtt_to_update[8] = {false};

void IRAM_ATTR handleISR_0() { switch_pressed[0] = true; }
void IRAM_ATTR handleISR_1() { switch_pressed[1] = true; }
void IRAM_ATTR handleISR_2() { switch_pressed[2] = true; }
void IRAM_ATTR handleISR_3() { switch_pressed[3] = true; }
void IRAM_ATTR handleISR_4() { switch_pressed[4] = true; }
void IRAM_ATTR handleISR_5() { switch_pressed[5] = true; }
void IRAM_ATTR handleISR_6() { switch_pressed[6] = true; }
void IRAM_ATTR handleISR_7() { switch_pressed[7] = true; }

void (*ISR_functions[8])() = {handleISR_0, handleISR_1, handleISR_2,
                              handleISR_3, handleISR_4, handleISR_5,
                              handleISR_6, handleISR_7};

void check_reset();
void detect_switchboard();
void sync_server();
// ---------------------------

void setup() {
    Serial.begin(115200);
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout protect

    pinMode(STATUS_LED, OUTPUT);

    pinMode(BOOT_BUTTON_PIN, INPUT_PULLUP);

    for (unsigned int i = 0; i < 8; ++i) {
        pinMode(RELAY_PINS[i], OUTPUT);
        digitalWrite(RELAY_PINS[i],
                     HIGH); // activelow - turn off all relays during boot

        pinMode(SWITCH_PINS[i], INPUT_PULLUP);
        attachInterrupt(digitalPinToInterrupt(SWITCH_PINS[i]), ISR_functions[i],
                        CHANGE);
    }

    connect_to_wifi();

    client.setServer(mqtt_server, atoi(mqtt_port));
    client.setCallback(callback);
}

void loop() {
    check_reset();
    if (WiFi.status() != WL_CONNECTED) {
        wifi_reconnect();
        return;
    }

    if (!client.connected()) {
        mqtt_reconnect();
        return;
    }
    client.loop();
    detect_switchboard();
    sync_server();
}

void detect_switchboard() {
    unsigned long curr_time = millis();

    for (int i = 0; i < 8; ++i) {
        if (!switch_pressed[i])
            continue;

        noInterrupts();
        switch_pressed[i] = false;
        interrupts();
        if ((curr_time - switch_debounce_time[i]) < DEBOUNCE_DELAY)
            continue;

        switch_debounce_time[i] = curr_time;
        bool curr_state = digitalRead(SWITCH_PINS[i]);
        // pullup so HIGH = OPEN, LOW = CLOSED

        digitalWrite(RELAY_PINS[i], curr_state); // active-low relays
        mqtt_pending_updates[i] = true;
        mqtt_to_update[i] = !curr_state;
        Serial.printf("Override: Switch [%s] %d\n", MQTT_TOPICS[i],
                      !curr_state);
    }
}

void sync_server() {
    for (int i = 0; i < 8; ++i) {
        if (mqtt_pending_updates[i]) {
            mqtt_pending_updates[i] = false;

            const char *payload = mqtt_to_update[i] ? "1" : "0";
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

                prefs.begin("nestboard-cfg", false);
                prefs.clear();
                prefs.end();

                digitalWrite(STATUS_LED, HIGH);
                delay(300);
                digitalWrite(STATUS_LED, LOW);
                delay(500);
                digitalWrite(STATUS_LED, HIGH);

                Serial.println("\n -------- RESTARTING -------\n");
                delay(3000);
                ESP.restart();
            }
        }
        digitalWrite(STATUS_LED, LOW);
    }
}
