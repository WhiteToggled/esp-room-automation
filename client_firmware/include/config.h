#pragma once

// connect to this wifi
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

// mqtt servr
#define MQTT_SERVER ""
#define MQTT_PORT 1883
#define MQTT_CLIENT_ID "ESP32_Nestboard1"

#define STATUS_LED 2

#define BOX_1

#ifdef BOX_1
inline const int RELAY_PINS[8] = {4, 16, 17, 18, 19, 21, 22, 23};
inline const int SWITCH_PINS[8] = {32, 33, 25, 26, 27, 14, 12, 13};
inline const char* MQTT_TOPICS[8] = {
  "r1/l1", "r1/f1",
  "r2/l1", "r2/f1",
  "r3/l1", "r3/f1",
  "r4/l1", "r4/f1"
};

#elif defined(BOX_2)
inline const int RELAY_PINS[8] = {14, 27, 26, 25, 33, 32, 13, 12};
inline const int SWITCH_PINS[8] = {};
inline const char *MQTT_TOPICS[8] = {
  "r5/l1", "r5/f1",
  "r6/l1", "r6/f1",
  "r7/l1", "r7/f1",
  "r8/l1", "r8/f1",
};

#endif // DEBUG

#define DEBOUNCE_DELAY 150
