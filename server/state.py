from typing import Dict

# In-memory device state: maps device_id (e.g. "r1/l1") to 0 or 1.
# Updated by MQTT messages and by control endpoints.
device_states: Dict[str, int] = {}
