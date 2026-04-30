export interface CabinDevice {
  id: string;
  label: string;
  isOn: boolean;
}

export interface Cabin {
  id: string;
  name: string;
  number: number;
  light: CabinDevice;
  fan: CabinDevice;
}

export const INITIAL_CABINS: Cabin[] = Array.from({ length: 8 }, (_, i) => ({
  id: `cabin-${i + 1}`,
  name: `Cabin ${i + 1}`,
  number: i + 1,
  light: {
    id: `light-${i + 1}`,
    label: 'Light',
    isOn: i % 3 === 0, // some on by default
  },
  fan: {
    id: `fan-${i + 1}`,
    label: 'Fan',
    isOn: i % 4 === 1,
  },
}));
