import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback used the first time the app runs (before the user overrides it) and
// whenever the saved value is cleared.
export const DEFAULT_BASE_URL = 'https://nestboard.iotpro.uk';
export const TOKEN_KEY = 'nestboard_token';

// Persisted key for the user-configurable server URL.
const BASE_URL_STORAGE_KEY = 'nestboard_base_url';

// In-memory copy so request code can read the URL synchronously once hydrated.
let currentBaseUrl: string | null = null;
let hydratePromise: Promise<void> | null = null;

// Accept things like "192.168.0.127", "192.168.0.127:8000", or a full URL and
// turn them into a usable base: default to a scheme, drop any trailing slash.
export function normalizeBaseUrl(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return DEFAULT_BASE_URL;
  if (!/^https?:\/\//i.test(url)) {
    // A bare LAN IP/hostname almost always speaks plain http, everything else https.
    const isLan = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(url) || url.startsWith('localhost');
    url = (isLan ? 'http://' : 'https://') + url;
  }
  return url.replace(/\/+$/, '');
}

// Loads the saved URL from storage once and caches it. Safe to call repeatedly.
async function ensureHydrated(): Promise<void> {
  if (currentBaseUrl !== null) return;
  if (!hydratePromise) {
    hydratePromise = AsyncStorage.getItem(BASE_URL_STORAGE_KEY)
      .then((saved) => {
        currentBaseUrl = saved ? normalizeBaseUrl(saved) : DEFAULT_BASE_URL;
      })
      .catch(() => {
        currentBaseUrl = DEFAULT_BASE_URL;
      });
  }
  await hydratePromise;
}

// Async getter used by request code — guarantees the persisted value is loaded.
export async function getBaseUrl(): Promise<string> {
  await ensureHydrated();
  return currentBaseUrl as string;
}

// Synchronous best-effort getter for UI/error messages after hydration.
export function getBaseUrlSync(): string {
  return currentBaseUrl ?? DEFAULT_BASE_URL;
}

// Updates the URL at runtime (in memory + persisted). Returns the normalized value.
export async function setBaseUrl(raw: string): Promise<string> {
  const normalized = normalizeBaseUrl(raw);
  currentBaseUrl = normalized;
  await AsyncStorage.setItem(BASE_URL_STORAGE_KEY, normalized);
  return normalized;
}
