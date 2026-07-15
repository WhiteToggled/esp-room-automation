#pragma once

#define STATUS_LED 4
#define BOOT_BUTTON_PIN 15
#define RESET_HOLD_TIME 5000

#define N_DEVICES 6
#define DEBOUNCE_DELAY 250
#define SYNC_SERVER_TOPIC "nestboard/sync"
#define STATUS_TOPIC "status"

#define DEVICE_1
#ifdef DEVICE_1
#define FIRMWARE_UPDATE_TOPIC "nestboard/firmware/update/1"

inline char mqtt_client_id[64] = "nestboard_1";
inline const int RELAY_PINS[N_DEVICES] = {27, 25, 14, 32, 33, 26};
inline const int SWITCH_PINS[N_DEVICES] = {23, 22, 18, 5, 17, 21};
inline const char *MQTT_TOPICS[N_DEVICES] = {
  "r1/l1", "r1/f1",
  "r2/l1", "r2/f1",
  "r3/l1", "r3:5:6/f1",
};
#elif defined(DEVICE_2)
#define FIRMWARE_UPDATE_TOPIC "nestboard/firmware/update/2"

inline char mqtt_client_id[64] = "nestboard_2";
inline const int RELAY_PINS[N_DEVICES] = {25, 27, 32, 14, 33, 14};
inline const int SWITCH_PINS[N_DEVICES] = {23, 22, 21, 18, 5, 17};
inline const char *MQTT_TOPICS[N_DEVICES] = {
  "r4/l1", "r4/f1",
  "r5/l1", "r3:5:6/f1",
  "r6/l1", "r3:5:6/f1",
};
#endif

// inline const int RELAY_PINS[N_DEVICES] = {14, 27, 26, 25, 33, 32};
// inline const int SWITCH_PINS[N_DEVICES] = {23, 22, 21, 18, 5, 17};
