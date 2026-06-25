#pragma once

void connect_to_wifi();
void wifi_reconnect();

void callback(char* topic, byte* payload, unsigned int length);
void mqtt_reconnect();

extern char mqtt_server[40];
extern char mqtt_port[6];
extern char mqtt_client_id[40];
extern Preferences prefs;
