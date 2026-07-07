#include <Arduino.h>
#include <Preferences.h>
#include <PubSubClient.h>
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

    Serial.println("Boo im an updated firmware!!!");

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

    static const char *root_ca PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

    espClient.setCACert(root_ca);
    client.setServer(mqtt_server, atoi(mqtt_port));
    client.setCallback(callback);
}

void loop() {
    wm.process();
    check_reset();
    detect_switchboard();
    if (WiFi.status() != WL_CONNECTED) {
        wifi_reconnect();
    } else if (!client.connected()) {
        mqtt_reconnect();
    } else {
        digitalWrite(STATUS_LED, LOW);
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

            const char *state = (digitalRead(RELAY_PINS[i]) == LOW) ? "1" : "0";
            char payload[32];
            snprintf(payload, sizeof(payload), "%s=%s", MQTT_TOPICS[i], state);
            client.publish(SYNC_SERVER_TOPIC, payload);
            Serial.printf("MQTT Publish: [%s] %s\n", SYNC_SERVER_TOPIC,
                          payload);
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
