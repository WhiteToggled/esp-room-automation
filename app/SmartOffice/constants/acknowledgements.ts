// Edit this file with the real project details and contributor names —
// nothing else needs to change for the Acknowledgements page to update.

export interface Contributor {
  name: string;
  role: string;
}

export const PROJECT_TITLE = 'Nestboard';
export const PROJECT_SUBTITLE = 'Room Automation System';
export const PROJECT_DETAIL = 'COAL Project · Semester 4 · 2024 Session · UET';

export const CONTRIBUTORS: Contributor[] = [
  { name: 'Abdullah Amir (2024-CS-156)', role: 'Frontend Developer' },
  { name: 'Ahmad Effendi (2024-CS-170)', role: 'Hardware & ESP32 Firmware' },
  { name: 'Ahmed Saeed (2024-CS-161)', role: 'Backend Developer' },
  // { name: 'Student Name 4', role: 'UI / UX Design' },
];

// Set to an empty string ('') to hide the supervisor line on the page.
export const SUPERVISOR = 'Sir Tehseen Ul Hasan Shah and Sir Ashir';
