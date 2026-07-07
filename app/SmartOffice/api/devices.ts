import client from './client';

export async function pingHealth(): Promise<{ status: string }> {
  return client.get('/health');
}

export interface Schedule {
  id: number;
  device_id: string;
  action: number;
  hour: number;
  minute: number;
  days: string[];
  enabled: boolean;
  created_by: string;
  created_at: string;
}

// Creation targets one or more devices at once; the server creates (and returns)
// one Schedule per device, all sharing the same time/days/action settings.
export interface ScheduleCreate {
  device_ids: string[];
  action: number;
  hour: number;
  minute: number;
  days: string[];
  enabled: boolean;
}
export type ScheduleUpdate = Partial<Omit<Schedule, 'id' | 'device_id' | 'created_by' | 'created_at'>>;

// GET /states now returns device states plus a room-prefix → display-name map.
// `names` only includes rooms the caller is allowed to see (all rooms for admin).
export interface StatesResponse {
  states: Record<string, number>;
  names: Record<string, string>;
}

export async function getStates(): Promise<StatesResponse> {
  const raw = await client.get('/states');
  // New shape: { states, names }. Stay tolerant of the old flat-map shape.
  if (raw && typeof raw === 'object' && 'states' in raw) {
    return { states: raw.states ?? {}, names: raw.names ?? {} };
  }
  return { states: (raw ?? {}) as Record<string, number>, names: {} };
}

export interface Room {
  room_id: string;
  name: string;
}

// GET /rooms — admin only; every room with its current display name.
export async function listRooms(): Promise<Room[]> {
  return client.get('/rooms');
}

// PUT /rooms/{room_id} — rename a room. Admin can rename any room; a regular
// user only their assigned rooms (backend returns 403 otherwise).
export async function renameRoom(roomId: string, name: string): Promise<Room> {
  return client.put(`/rooms/${encodeURIComponent(roomId)}`, { name });
}

// Response from POST /set/{device_id}. `affected_ids` lists every device the
// server changed — more than one when the device belongs to a group (e.g.
// toggling room1/l1 also switches its grouped siblings).
export interface SetResponse {
  id: string;
  new_state: 0 | 1;
  affected_ids: string[];
}

// Set a device to an explicit state (1 = on, 0 = off). Replaces the old
// /toggle endpoint, which flipped whatever state the server currently held.
export async function setDevice(deviceId: string, state: 0 | 1): Promise<SetResponse> {
  return client.post(`/set/${encodeURIComponent(deviceId)}?state=${state}`, {});
}

// Set every device the caller can see to an explicit state. Admin only.
export async function setAll(state: 0 | 1): Promise<{ message: string; count: number; new_state: 0 | 1 }> {
  return client.post(`/set-all?state=${state}`, {});
}

export async function lightsOn() {
  return client.post('/lights/on', {});
}

export async function fansOn() {
  return client.post('/fans/on', {});
}

export async function allOff() {
  return client.post('/all/off', {});
}

export interface StateLogEntry {
  id: number;
  logged_at: string;
  snapshot: Record<string, number>;
}

export async function getLogs(limit = 100): Promise<StateLogEntry[]> {
  return client.get(`/logs?limit=${limit}`);
}

export type LogRangePeriod = 'day' | 'week' | 'month';

export interface LogBucket {
  bucket_start: string;
  avg_on: number;
  peak_on: number;
  total: number;
  samples: number;
}

export async function getLogsRange(period: LogRangePeriod): Promise<LogBucket[]> {
  return client.get(`/logs/range?period=${period}`);
}

export async function triggerLog(): Promise<{ message: string; logged_at: string; snapshot: Record<string, number> }> {
  return client.post('/logs/trigger', {});
}

export async function listUsers(): Promise<{ username: string; role: string; rooms: string[] }[]> {
  return client.get('/users');
}

export async function assignUserRooms(username: string, rooms: string[]): Promise<void> {
  return client.put(`/users/${encodeURIComponent(username)}/rooms`, { rooms });
}

export async function listSchedules(): Promise<Schedule[]> {
  return client.get('/schedules');
}

// Returns one created Schedule per device_id. Validation is all-or-nothing:
// if any device is invalid/forbidden the server creates none.
export async function createSchedule(data: ScheduleCreate): Promise<Schedule[]> {
  return client.post('/schedules', data);
}

export async function updateSchedule(id: number, data: ScheduleUpdate): Promise<Schedule> {
  return client.put(`/schedules/${id}`, data);
}

export async function deleteSchedule(id: number): Promise<void> {
  return client.del(`/schedules/${id}`);
}

export async function createUser(username: string, password: string): Promise<{ username: string; role: string; rooms: string[] }> {
  return client.post('/users', { username, password, rooms: [] });
}

export async function deleteUser(username: string): Promise<void> {
  return client.del(`/users/${encodeURIComponent(username)}`);
}

export async function changePassword(username: string, newPassword: string): Promise<{ detail: string }> {
  return client.post('/change-password', { username, new_password: newPassword });
}
