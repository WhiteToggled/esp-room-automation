#pragma once

#include <WiFi.h>
#include "config.h"

void connect_to_wifi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    while(WiFi.status() != WL_CONNECTED) {
    digitalWrite(2, HIGH);
    delay(250);
    digitalWrite(2, LOW);
    delay(250);
        // delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.print("Conncted to wifi! Assigned IP Address : ");
    digitalWrite(2, LOW);
    Serial.println(WiFi.localIP());
}
