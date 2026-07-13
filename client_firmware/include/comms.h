#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include <WiFiManager.h>
#include <mqtt_client.h> // ESP-IDF MQTT client (bundled with arduino-esp32)

void connect_to_wifi();
void wifi_reconnect();
void update_prefs();

void mqtt_start();
void mqtt_reconfigure();
bool mqtt_publish(const char *topic, const char *payload);
void handle_ota_request(); // call from loop(); runs deferred OTA updates
void ota_progress_callback(int current, int total);

extern char mqtt_username[64];
extern char mqtt_pass[32];
extern char mqtt_server[128];
extern char mqtt_port[6];
// extern char mqtt_client_id[64];  // defined inline in config.h
extern bool update_config;

extern char eduroam_identity[64];
extern char eduroam_pass[64];

extern esp_mqtt_client_handle_t mqtt_client;
extern volatile bool mqtt_connected;

extern WiFiManager wm;
extern Preferences prefs;

extern WiFiManagerParameter param_mqtt_user;
extern WiFiManagerParameter param_mqtt_pass;
extern WiFiManagerParameter param_mqtt_server;
extern WiFiManagerParameter param_mqtt_port;
extern WiFiManagerParameter param_mqtt_id;

extern WiFiManagerParameter param_eduroam_identity;
extern WiFiManagerParameter param_eduroam_pass;
