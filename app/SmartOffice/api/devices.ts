import client from './client';

export async function getStates() {
  return client.get('/states');
}

export async function toggle(deviceId: string) {
  return client.post(`/toggle/${encodeURIComponent(deviceId)}`, {});
}

export async function toggleAll() {
  return client.post('/toggle-all', {});
}

export async function getLogs() {
  return client.get('/logs');
}

export async function triggerLog() {
  return client.post('/logs/trigger', {});
}
