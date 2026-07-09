import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, TOKEN_KEY } from '../constants/apiConfig';

// Registered by AuthContext. Invoked whenever an authenticated request comes back
// 401 (expired/invalid token) so the app can force a logout mid-session.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

// Shared response handling: if a request that carried a token is rejected with 401,
// the token is no longer valid — trigger the global logout handler.
async function handle(res: Response, hadToken: boolean) {
  if (res.status === 401 && hadToken && onUnauthorized) {
    onUnauthorized();
  }
  if (!res.ok) throw res;
  return res.json();
}

async function get(path: string) {
  const token = await getToken();
  const res = await fetch(`${await getBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handle(res, !!token);
}

async function post(path: string, body: any) {
  const token = await getToken();
  const res = await fetch(`${await getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handle(res, !!token);
}

async function del(path: string) {
  const token = await getToken();
  const res = await fetch(`${await getBaseUrl()}${path}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handle(res, !!token);
}

async function put(path: string, body: any) {
  const token = await getToken();
  const res = await fetch(`${await getBaseUrl()}${path}`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return handle(res, !!token);
}

// Specialized helper for OAuth2 form posts
async function postForm(path: string, form: Record<string, string>) {
  const body = Object.keys(form)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(form[k]))
    .join('&');
  const res = await fetch(`${await getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw res;
  return res.json();
}

export default { get, post, put, del, postForm, getToken };
