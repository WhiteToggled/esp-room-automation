#pragma once

#include <WiFi.h>
#include "config.h"

void connect_to_wifi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while(WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.print("Conncted to wifi! Assigned IP Address : ");
    Serial.println(WiFi.localIP());
}
