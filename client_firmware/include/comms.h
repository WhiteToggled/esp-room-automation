#pragma once
#include <WiFiClientSecure.h>

void connect_to_wifi();
void wifi_reconnect();

void callback(char* topic, byte* payload, unsigned int length);
void mqtt_reconnect();

extern char mqtt_username[64];
extern char mqtt_pass[32];
extern char mqtt_server[128];
extern char mqtt_port[6];
extern char mqtt_client_id[64];
extern bool update_config;

extern WiFiClientSecure espClient;
extern PubSubClient client;
extern WiFiManager wm;
extern Preferences prefs;

extern WiFiManagerParameter param_mqtt_user;
extern WiFiManagerParameter param_mqtt_pass;
extern WiFiManagerParameter param_mqtt_server;
extern WiFiManagerParameter param_mqtt_port;
extern WiFiManagerParameter param_mqtt_id;
