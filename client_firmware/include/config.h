#pragma once

// connect to this wifi
#define WIFI_SSID "bleh"
#define WIFI_PASSWORD "bleh"

// mqtt servr
#define MQTT_SERVER "10.34.135.42"
#define MQTT_PORT 1883

#define BOX_1

#ifdef BOX_1
#define PIN_INPUT_1 4
#define PIN_INPUT_2 16
#define PIN_INPUT_3 17
#define PIN_INPUT_4 18
#define PIN_INPUT_5 19
#define PIN_INPUT_6 21
#define PIN_INPUT_7 22
#define PIN_INPUT_8 23

#define TOPIC_INPUT_1 "r1/l1"
#define TOPIC_INPUT_2 "r1/l2"
#define TOPIC_INPUT_3 "r1/l3"
#define TOPIC_INPUT_4 "r1/l4"
#define TOPIC_INPUT_5 "r1/l5"
#define TOPIC_INPUT_6 "r1/l6"
#define TOPIC_INPUT_7 "r1/f1"
#define TOPIC_INPUT_8 "r1/f2"

#elif defined(BOX_2)
#define PIN_INPUT_1 14
#define PIN_INPUT_2 27
#define PIN_INPUT_3 26
#define PIN_INPUT_4 25
#define PIN_INPUT_5 33
#define PIN_INPUT_6 32
#define PIN_INPUT_7 13
#define PIN_INPUT_8 12

#define TOPIC_INPUT_1 "r2/l1"
#define TOPIC_INPUT_2 "r2/l2"
#define TOPIC_INPUT_3 "r2/l3"
#define TOPIC_INPUT_4 "r2/l4"
#define TOPIC_INPUT_5 "r2/l5"
#define TOPIC_INPUT_6 "r2/l6"
#define TOPIC_INPUT_7 "r2/f1"
#define TOPIC_INPUT_8 "r2/f2"
#endif // DEBUG
