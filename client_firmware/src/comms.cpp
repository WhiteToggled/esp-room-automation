#include <Arduino.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <mqtt_client.h>
#include "esp_wpa2.h"

#include "comms.h"
#include "config.h"

WiFiManager wm;
Preferences prefs;

esp_mqtt_client_handle_t mqtt_client = nullptr;
volatile bool mqtt_connected = false;

char mqtt_username[64] = "mqtt_user";
char mqtt_pass[32] = "psass";
char mqtt_server[128] = "serverip";
char mqtt_port[6] = "9001";
bool update_config = false;

// for eduroam
char eduroam_identity[64] = "";
char eduroam_pass[64] = "";

static char mqtt_uri[176]; // ws://<host>:<port>

// OTA requests arrive on the MQTT task -- they are executed from loop(),
// because the MQTT task's stack is too small for a TLS firmware download.
static volatile bool ota_requested = false;
static char ota_url[256];

// for lwt
char lwt_message[64];
char active_message[64];

WiFiManagerParameter param_mqtt_user("username", "MQTT Username", mqtt_username, 64);
WiFiManagerParameter param_mqtt_pass("password", "MQTT Password", mqtt_pass, 32);
WiFiManagerParameter param_mqtt_server("server", "MQTT Server IP", mqtt_server, 128);
WiFiManagerParameter param_mqtt_port("port", "MQTT WebSocket Port", mqtt_port, 6);
WiFiManagerParameter param_mqtt_id("client_id", "MQTT Client ID", mqtt_client_id, 64);
WiFiManagerParameter param_eduroam_identity("edu_identity", "Eduroam Identity (Username)", eduroam_identity, 64);
WiFiManagerParameter param_eduroam_pass("edu_pass", "Eduroam Password", eduroam_pass, 64);

void update_cfg_callback() { Serial.println("I WAS CALLED IM SAVE!!!");update_config = true; }

void update_prefs() {
    prefs.begin("nestboard-cfg", false);

    strlcpy(eduroam_identity, param_eduroam_identity.getValue(), sizeof(eduroam_identity));
    strlcpy(eduroam_pass, param_eduroam_pass.getValue(), sizeof(eduroam_pass));

    prefs.putString("edu_id", eduroam_identity);
    prefs.putString("edu_pass", eduroam_pass);

    strlcpy(mqtt_username, param_mqtt_user.getValue(), sizeof(mqtt_username));
    strlcpy(mqtt_pass, param_mqtt_pass.getValue(), sizeof(mqtt_pass));
    strlcpy(mqtt_server, param_mqtt_server.getValue(), sizeof(mqtt_server));
    strlcpy(mqtt_port, param_mqtt_port.getValue(), sizeof(mqtt_port));
    strlcpy(mqtt_client_id, param_mqtt_id.getValue(), sizeof(mqtt_client_id));

    prefs.putString("mq_user", mqtt_username);
    prefs.putString("mq_pass", mqtt_pass);
    prefs.putString("mq_server", mqtt_server);
    prefs.putString("mq_port", mqtt_port);
    prefs.putString("mq_id", mqtt_client_id);

    prefs.end();

    Serial.println("Updated Configuration!");
}

void connect_to_wifi() {
    prefs.begin("nestboard-cfg", false);

    strlcpy(mqtt_username, prefs.getString("mq_user", mqtt_username).c_str(), sizeof(mqtt_username));
    strlcpy(mqtt_pass, prefs.getString("mq_pass", mqtt_pass).c_str(), sizeof(mqtt_pass));
    strlcpy(mqtt_server, prefs.getString("mq_server", mqtt_server).c_str(), sizeof(mqtt_server));
    strlcpy(mqtt_port, prefs.getString("mq_port", mqtt_port).c_str(), sizeof(mqtt_port));
    strlcpy(mqtt_client_id, prefs.getString("mq_id", mqtt_client_id).c_str(), sizeof(mqtt_client_id));
    strlcpy(eduroam_identity, prefs.getString("edu_id", "").c_str(), sizeof(eduroam_identity));
    strlcpy(eduroam_pass, prefs.getString("edu_pass", "").c_str(), sizeof(eduroam_pass));

    prefs.end();

    Serial.printf("Loaded Eduroam: '%s'\n", eduroam_identity);


    wm.setConfigPortalTimeout(180);
    wm.setConfigPortalBlocking(false);
    wm.setSaveParamsCallback(update_cfg_callback);
    wm.setConnectTimeout(10);

    wm.addParameter(&param_mqtt_user);
    wm.addParameter(&param_mqtt_pass);
    wm.addParameter(&param_mqtt_server);
    wm.addParameter(&param_mqtt_port);
    wm.addParameter(&param_mqtt_id);
    wm.addParameter(&param_eduroam_identity);
    wm.addParameter(&param_eduroam_pass);

    bool connected = false;

    // Try stored Eduroam credentials first
    if (strlen(eduroam_identity) > 0) {
        Serial.println("Trying stored eduroam credentials...");

        WiFi.disconnect(true, true);
        delay(100);
        WiFi.mode(WIFI_STA);

        WiFi.begin( "eduroam", WPA2_AUTH_PEAP, eduroam_identity, eduroam_identity, eduroam_pass);

        int timeout = 0;
        while (WiFi.status() != WL_CONNECTED && timeout < 60) {
            delay(500);
            Serial.print(".");
            timeout++;
        }
        connected = WiFi.status() == WL_CONNECTED;
    }

    // Open portal if connection failed
    if (!connected) {
        Serial.println("\nStarting configuration portal...");

        connected = wm.autoConnect("Nestboard-Setup");
        // ALWAYS save portal changes
        if (update_config) {
            Serial.println("Saving new configuration...");
            update_prefs();
            update_config = false;
        }
    }

    if (!connected) {
        Serial.println("Starting offline mode");
        return;
    }


    digitalWrite(STATUS_LED, LOW);

    Serial.println("Connected!");
    Serial.println(WiFi.localIP());
}

void wifi_reconnect() {
    if (wm.getConfigPortalActive()) { return; }
    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(STATUS_LED, LOW);
        return;
    }

    static unsigned long lastAttempt = 0;
    unsigned long now = millis();
    if (now - lastAttempt < 30000)
        return;

    lastAttempt = now;

    digitalWrite(STATUS_LED, HIGH);
    Serial.printf("[RECONNECT] identity='%s'\n", eduroam_identity);
    Serial.println("WiFi lost, reconnecting...");
    if (strlen(eduroam_identity) > 0) {
        Serial.println("Trying eduroam PEAP...");
        WiFi.disconnect(false, true);
        delay(100);

        WiFi.mode(WIFI_STA);
        WiFi.begin( "eduroam", WPA2_AUTH_PEAP, eduroam_identity, eduroam_identity, eduroam_pass);
    } else {
        Serial.println("Trying normal WiFi reconnect...");
        WiFi.reconnect();
    }
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

        mqtt_publish(STATUS_TOPIC, active_message);
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
    if (mqtt_client != nullptr)
        return; // already started

    // snprintf(mqtt_uri, sizeof(mqtt_uri), "wss://%s:%s", mqtt_server, mqtt_port);
    snprintf(mqtt_uri, sizeof(mqtt_uri), "ws://%s:%s/", mqtt_server, mqtt_port);
    Serial.printf("Starting MQTT over WebSocket: %s\n", mqtt_uri);

    snprintf(lwt_message, sizeof(lwt_message), "%s=0", mqtt_client_id);
    snprintf(active_message, sizeof(active_message), "%s=1", mqtt_client_id);

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

    cfg.lwt_topic = STATUS_TOPIC;
    cfg.lwt_msg = lwt_message;
    cfg.lwt_msg_len = strlen(lwt_message);
    cfg.lwt_qos = 1;
    cfg.lwt_retain = 1;
    // cfg.skip_cert_common_name_check = true;
#endif

    mqtt_client = esp_mqtt_client_init(&cfg);
    esp_mqtt_client_register_event(mqtt_client, MQTT_EVENT_ANY,
                                   mqtt_event_handler, nullptr);
    // Runs in its own task; handles reconnects and keepalive by itself.
    esp_mqtt_client_start(mqtt_client);
}

void mqtt_reconfigure() {
    if (mqtt_client != nullptr) {
        Serial.println("Stopping MQTT client to apply new config...");
        esp_mqtt_client_stop(mqtt_client);
        esp_mqtt_client_destroy(mqtt_client);
        mqtt_client = nullptr;
        mqtt_connected = false;
    }

    // 1. Rebuild the URI string with the freshly saved parameters
    snprintf(mqtt_uri, sizeof(mqtt_uri), "ws://%s:%s/mqtt", mqtt_server, mqtt_port);
    Serial.printf("New MQTT URI: %s\n", mqtt_uri);

    snprintf(lwt_message, sizeof(lwt_message), "%s=0", mqtt_client_id);
    snprintf(active_message, sizeof(active_message), "%s=1", mqtt_client_id);

    // 2. Define the new configuration
    esp_mqtt_client_config_t mqtt_cfg = {};
    mqtt_cfg.uri = mqtt_uri;
    mqtt_cfg.username = mqtt_username;
    mqtt_cfg.password = mqtt_pass;
    mqtt_cfg.client_id = mqtt_client_id;

    mqtt_cfg.lwt_topic = STATUS_TOPIC;
    mqtt_cfg.lwt_msg = lwt_message;
    mqtt_cfg.lwt_msg_len = strlen(lwt_message);
    mqtt_cfg.lwt_qos = 1;
    mqtt_cfg.lwt_retain = 1;

    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, MQTT_EVENT_ANY,
                                   mqtt_event_handler, nullptr);
    esp_mqtt_client_start(mqtt_client);
}

bool mqtt_publish(const char *topic, const char *payload) {
    if (mqtt_client == nullptr || !mqtt_connected)
        return false;
    // qos 0, no retain; len 0 => strlen(payload)
    return esp_mqtt_client_publish(mqtt_client, topic, payload, 0, 1, 1) >= 0;
}

// -------------- OTA --------------
static void update_ota(const char *url) {
    Serial.printf("Starting OTA update from URL: %s\n", url);

    // Free the MQTT client's socket + TLS memory before opening the
    // HTTPS connection for the update.
    if (mqtt_client != nullptr) {
        esp_mqtt_client_stop(mqtt_client);
        mqtt_connected = false;
    }

    httpUpdate.onProgress(ota_progress_callback);
    bool is_https = (strncmp(url, "https", 5) == 0);
    t_httpUpdate_return ret;

    httpUpdate.onProgress(ota_progress_callback);

    if (is_https) {
        Serial.println("Using Secure Client (HTTPS)...");
        WiFiClientSecure secureClient;
        secureClient.setInsecure(); // Skip certificate validation
        ret = httpUpdate.update(secureClient, url);
    } else {
        Serial.println("Using Plain Client (HTTP)...");
        WiFiClient plainClient; // Use standard unencrypted client
        ret = httpUpdate.update(plainClient, url);
    }

    // t_httpUpdate_return ret = httpUpdate.update(updateClient, url);
    switch (ret) {
    case HTTP_UPDATE_FAILED:
        Serial.printf("OTA Failed (%d): %s\n", httpUpdate.getLastError(),
                      httpUpdate.getLastErrorString().c_str());
        digitalWrite(STATUS_LED, HIGH);
        break;
    case HTTP_UPDATE_NO_UPDATES:
        Serial.println("No new updates available.");
        break;
    case HTTP_UPDATE_OK:
        Serial.println("OTA Successful! Rebooting...");
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

void ota_progress_callback(int current, int total) {
    static unsigned long lastFlash = 0;
    unsigned long now = millis();
    
    // 1Hz = 1 cycle per second -> Toggle every 500ms
    if (now - lastFlash >= 500) {
        lastFlash = now;
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
    }
}
