#include <Arduino.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <mqtt_client.h> // ESP-IDF MQTT client -- ships with arduino-esp32

#include "comms.h"
#include "config.h"

WiFiManager wm;
Preferences prefs;

<<<<<<< Updated upstream
char mqtt_username[64] = "test";
char mqtt_pass[32] = "testtest";
char mqtt_server[128] = "8d05a36cd6004e98b1164a0f2d05cbba.s1.eu.hivemq.cloud";
char mqtt_port[6] = "8883";
char mqtt_client_id[64] = "ESP32_Nestboard";
=======
esp_mqtt_client_handle_t mqtt_client = nullptr;
volatile bool mqtt_connected = false;

char mqtt_username[64] = "mqtt_user";
char mqtt_pass[32] = "muhehehe";
char mqtt_server[128] = "192.168.0.127";
// HiveMQ Cloud: 8883 = MQTT over TLS, 8884 = MQTT over WebSocket (TLS)
char mqtt_port[6] = "9001";
>>>>>>> Stashed changes
bool update_config = false;

static char mqtt_uri[176]; // wss://<host>:<port>/mqtt

// OTA requests arrive on the MQTT task -- they are executed from loop(),
// because the MQTT task's stack is too small for a TLS firmware download.
static volatile bool ota_requested = false;
static char ota_url[256];

// ISRG Root X1 (Let's Encrypt) -- same CA HiveMQ Cloud presents on 8884
static const char *root_ca = R"EOF(
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

WiFiManagerParameter param_mqtt_user("username", "MQTT Username", mqtt_username,
                                     64);
WiFiManagerParameter param_mqtt_pass("password", "MQTT Password", mqtt_pass,
                                     32);
WiFiManagerParameter param_mqtt_server("server", "MQTT Server IP", mqtt_server,
                                       128);
WiFiManagerParameter param_mqtt_port("port", "MQTT WebSocket Port", mqtt_port,
                                     6);
WiFiManagerParameter param_mqtt_id("client_id", "MQTT Client ID",
                                   mqtt_client_id, 64);

void update_cfg_callback() { update_config = true; }

void connect_to_wifi() {
    prefs.begin("nestboard-cfg", false);

    String pref_username = prefs.getString("mq_user", "mqtt_user");
    String pref_pass = prefs.getString("mq_pass", "muhehehe");
    String pref_server = prefs.getString(
<<<<<<< Updated upstream
        "mq_server", "8d05a36cd6004e98b1164a0f2d05cbba.s1.eu.hivemq.cloud");
    String pref_port = prefs.getString("mq_port", "8883");
    String pref_client_id = prefs.getString("mq_id", "ESP32_Nestboard");
=======
        "mq_server", "192.168.0.127");
    String pref_port = prefs.getString("mq_port", "9001");
    String pref_client_id = prefs.getString("mq_id", mqtt_client_id);
>>>>>>> Stashed changes

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
        prefs.end();
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

// -------------- MQTT over WebSockets (ESP-IDF client) --------------

// Same relay/prefs logic that used to live in the PubSubClient callback.
// NOTE: this runs on the MQTT client's task, not on loop() -- that's fine
// for digitalWrite and NVS (both thread-safe), but NOT for OTA, which is
// why firmware updates are deferred to loop() via ota_requested.
static void handle_message(const char *topic, const char *message) {
    Serial.printf("Message arrived: [%s] %s\n", topic, message);

    if (strcmp(topic, FIRMWARE_UPDATE_TOPIC) == 0) {
        strncpy(ota_url, message, sizeof(ota_url) - 1);
        ota_url[sizeof(ota_url) - 1] = '\0';
        ota_requested = true;
        return;
    }

    int target_state = atoi(message);
    target_state = !target_state; // relays are active-low

<<<<<<< Updated upstream
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
=======
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

static void mqtt_event_handler(void *args, esp_event_base_t base,
                               int32_t event_id, void *event_data) {
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        Serial.println("MQTT Connected (WebSocket)!");
        mqtt_connected = true;
        // (Re)subscribe on every connect so reconnects restore subscriptions
        for (int i = 0; i < N_DEVICES; i++) {
            esp_mqtt_client_subscribe(mqtt_client, MQTT_TOPICS[i], 1);
        }
        esp_mqtt_client_subscribe(mqtt_client, FIRMWARE_UPDATE_TOPIC, 1);
        break;

    case MQTT_EVENT_DISCONNECTED:
        Serial.println("MQTT disconnected, client will retry...");
        mqtt_connected = false;
        break;

    case MQTT_EVENT_DATA: {
        // topic/data are NOT null-terminated -- copy into bounded buffers
        char topic[128];
        char message[256];

        int tlen = event->topic_len;
        if (tlen > (int)sizeof(topic) - 1)
            tlen = sizeof(topic) - 1;
        memcpy(topic, event->topic, tlen);
        topic[tlen] = '\0';

        int mlen = event->data_len;
        if (mlen > (int)sizeof(message) - 1)
            mlen = sizeof(message) - 1;
        memcpy(message, event->data, mlen);
        message[mlen] = '\0';

        handle_message(topic, message);
        break;
    }

    case MQTT_EVENT_ERROR:
        // TLS / transport / WebSocket handshake errors land here
        Serial.println("MQTT error event");
        break;

    default:
        break;
    }
}

void mqtt_start() {
//   pinMode(2, OUTPUT);
// digitalWrite(2, HIGH);
    if (mqtt_client != nullptr)
        return; // already started

    // snprintf(mqtt_uri, sizeof(mqtt_uri), "wss://%s:%s", mqtt_server, mqtt_port);
    snprintf(mqtt_uri, sizeof(mqtt_uri), "ws://%s:%s/", mqtt_server, mqtt_port);
    Serial.printf("Starting MQTT over WebSocket: %s\n", mqtt_uri);

    esp_mqtt_client_config_t cfg = {};

#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
    // arduino-esp32 core 3.x (ESP-IDF 5.x) -- nested config struct
    cfg.broker.address.uri = mqtt_uri;
    cfg.credentials.username = mqtt_username;
    cfg.credentials.authentication.password = mqtt_pass;
    cfg.credentials.client_id = mqtt_client_id;
    cfg.session.keepalive = 30;
    // cfg.broker.verification.skip_cert_common_name_check = true;
#else
    // arduino-esp32 core 2.x (ESP-IDF 4.4) -- flat config struct
    cfg.uri = mqtt_uri;
    cfg.username = mqtt_username;
    cfg.password = mqtt_pass;
    cfg.client_id = mqtt_client_id;
    cfg.keepalive = 30;
    // cfg.skip_cert_common_name_check = true;
#endif

    mqtt_client = esp_mqtt_client_init(&cfg);
    esp_mqtt_client_register_event(mqtt_client, MQTT_EVENT_ANY,
                                   mqtt_event_handler, nullptr);
    // Runs in its own task; handles reconnects and keepalive by itself.
    esp_mqtt_client_start(mqtt_client);
}

bool mqtt_publish(const char *topic, const char *payload) {
    if (mqtt_client == nullptr || !mqtt_connected)
        return false;
    // qos 0, no retain; len 0 => strlen(payload)
    return esp_mqtt_client_publish(mqtt_client, topic, payload, 0, 0, 0) >= 0;
}

// -------------- OTA --------------
static void update_ota(const char *url) {
>>>>>>> Stashed changes
    Serial.printf("Starting OTA update from URL: %s\n", url);

    // Free the MQTT client's socket + TLS memory before opening the
    // HTTPS connection for the update.
    if (mqtt_client != nullptr) {
        esp_mqtt_client_stop(mqtt_client);
        mqtt_connected = false;
    }

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

    // Update didn't happen -- bring MQTT back up.
    if (mqtt_client != nullptr) {
        esp_mqtt_client_start(mqtt_client);
    }
}

void handle_ota_request() {
    if (!ota_requested)
        return;
    ota_requested = false;
    update_ota(ota_url);
}
