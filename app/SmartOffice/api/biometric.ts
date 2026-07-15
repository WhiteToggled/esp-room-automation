// Biometric (Face ID / fingerprint) login.
//
// Flow, per the backend contract:
//   1. Enrollment (once, while logged in): generate a P-256 keypair on-device,
//      send only the PUBLIC key to POST /devices/{device_id}/biometric-key.
//      The private key is stored in the OS keychain/keystore, gated behind
//      biometrics (expo-secure-store `requireAuthentication`), so it can never
//      be read without a Face ID / fingerprint check.
//   2. Login: POST /auth/biometric/challenge → nonce; sign "{nonce}:{timestamp}"
//      with ECDSA-SHA256; POST /auth/biometric/verify → same payload as /login.
//
// The private key never leaves the device and is only readable after the user
// passes the biometric prompt the keychain shows on read.

// IMPORTANT: this MUST be the first import — it installs crypto.getRandomValues
// before `@noble/*` loads and captures it. Do not reorder below the noble imports.
import './cryptoPolyfill';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import client from './client';
import { BASE_URL } from '../constants/apiConfig';

// ── Storage keys ────────────────────────────────────────────────────────────
const DEVICE_ID_KEY = 'nestboard_device_id';       // stable per-install id (client-chosen)
const BIO_USER_KEY = 'nestboard_biometric_user';   // which username is enrolled here
const PRIV_KEY_STORE = 'nestboard_biometric_priv';  // biometric-gated private key (hex)

// SecureStore options that put the private key behind a biometric gate.
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// ── Small byte helpers (no Buffer/btoa in RN) ───────────────────────────────
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64_ALPHABET[b2 & 0x3f] : '=';
  }
  return out;
}

// The message is ASCII (hex nonce + ':' + decimal timestamp), so char codes ARE bytes.
function asciiToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// Fixed ASN.1 header for a prime256v1 (P-256) SubjectPublicKeyInfo. Prepending
// it to the 65-byte uncompressed point yields a full DER SPKI the server accepts.
const P256_SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
  0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
]);

function publicKeyToSpkiBase64(uncompressed: Uint8Array): string {
  const spki = new Uint8Array(P256_SPKI_PREFIX.length + uncompressed.length);
  spki.set(P256_SPKI_PREFIX, 0);
  spki.set(uncompressed, P256_SPKI_PREFIX.length);
  return bytesToBase64(spki);
}

// ── Device id (client-chosen, stable per install) ───────────────────────────
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Capability / status ─────────────────────────────────────────────────────
export interface BiometricCapability {
  available: boolean; // hardware present AND the user has a biometric enrolled in the OS
  label: string;      // "Face ID" | "Fingerprint" | "Iris" | "Biometrics"
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const T = LocalAuthentication.AuthenticationType;
    let label = 'Biometrics';
    if (types.includes(T.FACIAL_RECOGNITION)) label = 'Face ID';
    else if (types.includes(T.FINGERPRINT)) label = 'Fingerprint';
    else if (types.includes(T.IRIS)) label = 'Iris';
    return { available: hasHardware && enrolled, label };
  } catch {
    return { available: false, label: 'Biometrics' };
  }
}

// Which username (if any) has biometric login set up on THIS device.
export async function getEnrolledUsername(): Promise<string | null> {
  return AsyncStorage.getItem(BIO_USER_KEY);
}

export async function isEnrolledLocally(): Promise<boolean> {
  return !!(await AsyncStorage.getItem(BIO_USER_KEY));
}

// ── Enrollment (must be called while logged in — uses the bearer token) ──────
export async function enrollBiometric(username: string): Promise<void> {
  const deviceId = await getDeviceId();

  const priv = p256.utils.randomPrivateKey();       // 32 bytes
  const pub = p256.getPublicKey(priv, false);       // 65-byte uncompressed point
  const publicKey = publicKeyToSpkiBase64(pub);     // base64 DER SPKI

  // Register the public key first; only persist the private key if the server accepts it.
  await client.post(`/devices/${encodeURIComponent(deviceId)}/biometric-key`, {
    public_key: publicKey,
  });

  await SecureStore.setItemAsync(PRIV_KEY_STORE, bytesToHex(priv), SECURE_OPTS);
  await AsyncStorage.setItem(BIO_USER_KEY, username);
}

export async function disableBiometric(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PRIV_KEY_STORE, SECURE_OPTS);
  } catch {
    // key may already be gone
  }
  await AsyncStorage.removeItem(BIO_USER_KEY);
}

// ── Login ────────────────────────────────────────────────────────────────────
export interface BiometricLoginResult {
  access_token: string;
  token_type: string;
  username: string;
  role: string;
  rooms: string[];
}

// challenge/verify are unauthenticated — a POST that never attaches a token.
async function postNoAuth(path: string, body: any) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw res;
  return res.json();
}

export async function biometricLogin(): Promise<BiometricLoginResult> {
  const deviceId = await getDeviceId();
  const username = await getEnrolledUsername();
  if (!username) throw new Error('Biometric login is not set up on this device.');

  // 1. Challenge
  const { challenge } = await postNoAuth('/auth/biometric/challenge', {
    username,
    device_id: deviceId,
  });

  // 2. Sign "{nonce}:{timestamp}" with ECDSA-SHA256. noble signs the digest we
  //    pass (prehash defaults to false), so we hash the message ourselves.
  const timestamp = Date.now();
  const message = `${challenge}:${timestamp}`;
  const digest = sha256(asciiToBytes(message));

  // Reading the key shows the biometric prompt; a cancel/failure throws here.
  const privHex = await SecureStore.getItemAsync(PRIV_KEY_STORE, {
    ...SECURE_OPTS,
    authenticationPrompt: 'Confirm it’s you to sign in',
  });
  if (!privHex) {
    throw new Error('Your biometric key is missing. Please re-enable biometric login.');
  }

  const sig = p256.sign(digest, hexToBytes(privHex));
  const signature = bytesToBase64(sig.toDERRawBytes());

  // 3. Verify → same shape as /login
  return postNoAuth('/auth/biometric/verify', {
    device_id: deviceId,
    nonce: challenge,
    signature,
    timestamp,
  });
}