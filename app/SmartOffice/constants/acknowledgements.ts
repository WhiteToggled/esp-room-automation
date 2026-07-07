// Edit this file with the real project details and contributor names —
// nothing else needs to change for the Acknowledgements page to update.

import type { ImageSourcePropType } from 'react-native';

export interface Contributor {
  name: string;
  role: string;
  // Optional profile picture. Use a static require(), e.g.
  //   avatar: require('../assets/images/profile/abdullah.jpg')
  // When omitted, the contributor's initials are shown instead.
  avatar?: ImageSourcePropType;
}

export const PROJECT_TITLE = 'Nestboard';
export const PROJECT_SUBTITLE = 'Room Automation System';
export const PROJECT_DETAIL = 'COAL Project · Semester 4 · 2024 Session · UET';

export const CONTRIBUTORS: Contributor[] = [
  {
    name: 'Abdullah Amir (2024-CS-156)',
    role: 'Frontend Developer',
    avatar: require('../assets/images/profile/abdullah1.jpg'),
  },
  {
    name: 'Ahmad Effendi (2024-CS-170)',
    role: 'Hardware & ESP32 Firmware',
    // Add photo: drop the image in assets/images/profile/ and uncomment:
    avatar: require('../assets/images/profile/ahmad.png'),
  },
  {
    name: 'Ahmed Saeed (2024-CS-161)',
    role: 'Backend Developer',
    // Add photo: drop the image in assets/images/profile/ and uncomment:
    avatar: require('../assets/images/profile/ahmed1.jpg'),
  },
  // { name: 'Student Name 4', role: 'UI / UX Design' },
];

// Set to an empty string ('') to hide the supervisor line on the page.
export const SUPERVISOR = 'Sir Tehseen Ul Hasan Shah and Sir Ashir';
