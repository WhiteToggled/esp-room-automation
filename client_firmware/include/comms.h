#pragma once

void connect_to_wifi();
void wifi_reconnect();

void callback(char* topic, byte* payload, unsigned int length);
void mqtt_reconnect();
