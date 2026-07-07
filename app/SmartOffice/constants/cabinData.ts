export interface CabinDevice {
  id: string;
  label: string;
  isOn: boolean;
  topic?: string; // optional backend MQTT topic mapping (e.g. 'r1/l1')
}

export interface Cabin {
  id: string;
  name: string;
  number: number;
  light: CabinDevice;
  fan: CabinDevice;
}

export const INITIAL_CABINS: Cabin[] = Array.from({ length: 6 }, (_, i) => ({
  id: `cabin-${i + 1}`,
  name: `Cabin ${i + 1}`,
  number: i + 1,
  light: {
    id: `light-${i + 1}`,
    label: 'Light',
    isOn: i % 3 === 0, // some on by default
    // Each cabin light maps to a backend MQTT topic that the server log tracks.
    topic: `r${i + 1}/l1`,
  },
  fan: {
    id: `fan-${i + 1}`,
    label: 'Fan',
    isOn: i % 4 === 1,
    topic: `r${i + 1}/f1`,
  },
}));
