#pragma once

#define STATUS_LED 4
#define BOOT_BUTTON_PIN 15
#define RESET_HOLD_TIME 5000

#define N_DEVICES 6

inline const int RELAY_PINS[N_DEVICES] = {14, 27, 26, 25, 33, 32};
inline const int SWITCH_PINS[N_DEVICES] = {23, 22, 21, 19, 18, 5};
inline const char *MQTT_TOPICS[N_DEVICES] = {
  "r1/l1", "r1/f1",
  "r2/l1", "r2/f1",
  "r3/l1", "r3/f1",
};

#define DEBOUNCE_DELAY 250
