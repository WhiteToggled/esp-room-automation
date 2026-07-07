import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lightweight stale-while-revalidate cache for read-only API resources.
//
//  • In-memory layer  → instant reads across tab switches within a session.
//  • AsyncStorage layer → data survives app restarts (shown immediately on next open).
//  • TTL               → the network is only hit again once the cached copy is stale,
//                        so flicking between tabs doesn't refetch every time.

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const memory = new Map<string, CacheEntry<unknown>>();
const storageKey = (key: string) => `rc:${key}`;

function readMemory<T>(key: string): CacheEntry<T> | undefined {
  return memory.get(key) as CacheEntry<T> | undefined;
}

function writeCache<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  memory.set(key, entry);
  AsyncStorage.setItem(storageKey(key), JSON.stringify(entry)).catch(() => {});
}

async function readCache<T>(key: string): Promise<CacheEntry<T> | undefined> {
  const mem = readMemory<T>(key);
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      memory.set(key, entry);
      return entry;
    }
  } catch (_) {}
  return undefined;
}

interface Options<T> {
  /** How long a cached copy is considered fresh (ms). Within this window, no refetch. */
  ttlMs: number;
  /** Value used before any cache/network resolves. */
  initialData: T;
  /** When false, the resource neither loads nor revalidates (e.g. tab not visible). */
  active?: boolean;
}

export function useCachedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttlMs, initialData, active = true }: Options<T>,
) {
  // Seed synchronously from the in-memory cache so a return visit renders the
  // last data instantly instead of flashing a loading state.
  const seed = readMemory<T>(key);
  const [data, setData] = useState<T>(seed ? seed.data : initialData);
  const [loading, setLoading] = useState<boolean>(!seed);
  const [refreshing, setRefreshing] = useState(false);

  // Keep the latest fetcher without making `load` depend on its (per-render) identity.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (force: boolean) => {
    const cached = await readCache<T>(key);
    if (cached) {
      setData(cached.data);
      setLoading(false);
      // Fresh enough and not a forced refresh → serve cache, skip the network.
      if (!force && Date.now() - cached.ts < ttlMs) return;
    }
    try {
      const fresh = await fetcherRef.current();
      writeCache(key, fresh);
      setData(fresh);
    } catch (_) {
      // Network failed — keep whatever cached value we already showed.
    } finally {
      setLoading(false);
    }
  }, [key, ttlMs]);

  // Runs on mount, when the key changes, and when the resource becomes active.
  useEffect(() => {
    if (active) load(false);
  }, [active, load]);

  // Pull-to-refresh: always hits the network and drives the refresh spinner.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // Force a background reload (e.g. after a mutation) without the refresh spinner.
  const reload = useCallback(() => load(true), [load]);

  return { data, loading, refreshing, refresh, reload, setData };
}
