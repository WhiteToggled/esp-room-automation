from typing import Dict, List

device_states: Dict[str, int] = {}
room_names: Dict[str, str] = {}
device_to_group: Dict[str, str] = {}        # device_id → group mqtt_topic
group_to_devices: Dict[str, List[str]] = {} # group mqtt_topic → [device_id, ...]
