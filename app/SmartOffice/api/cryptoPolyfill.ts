// Must run BEFORE any `@noble/*` import. noble captures `globalThis.crypto`
// once, at module-load time (@noble/hashes/crypto.js), so if the RNG isn't in
// place by then it stays `undefined` forever and key generation throws
// "crypto.getRandomValues must be defined". Hermes ships no Web Crypto RNG, so
// we install one backed by expo-crypto's real device randomness.
import * as Crypto from 'expo-crypto';

const g: any = globalThis as any;

function getRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (array == null) return array;
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  view.set(Crypto.getRandomBytes(view.byteLength));
  return array;
}

if (!g.crypto || typeof g.crypto.getRandomValues !== 'function') {
  // globalThis.crypto may be absent (define it) or a frozen partial (define the
  // method on it). Guard each step so a locked-down runtime can't crash startup.
  if (!g.crypto) {
    try {
      Object.defineProperty(g, 'crypto', { value: {}, configurable: true, writable: true });
    } catch {
      g.crypto = {};
    }
  }
  try {
    g.crypto.getRandomValues = getRandomValues;
  } catch {
    try {
      Object.defineProperty(g.crypto, 'getRandomValues', {
        value: getRandomValues,
        configurable: true,
        writable: true,
      });
    } catch {
      // Give up silently; noble will surface a clear error if it's still missing.
    }
  }
}

export {};