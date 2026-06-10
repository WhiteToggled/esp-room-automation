import client from './client';

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

export type ScheduleCreate = Omit<Schedule, 'id' | 'created_by' | 'created_at'>;
export type ScheduleUpdate = Partial<Omit<Schedule, 'id' | 'device_id' | 'created_by' | 'created_at'>>;

export async function getStates() {
  return client.get('/states');
}

export async function toggle(deviceId: string) {
  return client.post(`/toggle/${encodeURIComponent(deviceId)}`, {});
}

export async function toggleAll() {
  return client.post('/toggle-all', {});
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

export async function getLogs() {
  return client.get('/logs');
}

export async function triggerLog() {
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

export async function createSchedule(data: ScheduleCreate): Promise<Schedule> {
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
