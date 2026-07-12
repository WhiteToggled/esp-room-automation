import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setUnauthorizedHandler } from '../api/client';
import { getBaseUrlSync, TOKEN_KEY } from '../constants/apiConfig';
import {
  biometricLogin as bioLogin,
  enrollBiometric,
  disableBiometric,
} from '../api/biometric';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  // A user can be assigned any number of cabins (rooms). Empty = none.
  assignedCabinIds: string[];
}

// r1 -> cabin-1
const roomsToCabinIds = (rooms: string[]): string[] =>
  rooms.map((r) => 'cabin-' + r.replace('r', ''));

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  // Sign in on this device using the enrolled biometric key. `cancelled` is set
  // when the user simply dismisses the Face ID / fingerprint prompt.
  biometricLogin: () => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  // Enroll the currently logged-in user for biometric login on this device.
  enableBiometric: () => Promise<{ success: boolean; error?: string }>;
  // Remove biometric login from this device.
  disableBiometric: () => Promise<void>;
}

const ADMIN: AppUser = {
  id: 'admin',
  name: 'Admin',
  email: 'admin@nestboard.com',
  password: 'admin123',
  role: 'admin',
  assignedCabinIds: [],
};

const SESSION_KEY = 'nestboard_session';
const TOKEN_STORAGE_KEY = TOKEN_KEY;

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  signup: async () => ({ success: false }),
  biometricLogin: async () => ({ success: false }),
  enableBiometric: async () => ({ success: false }),
  disableBiometric: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [id, token] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      ]);
      if (id) {
        if (id === ADMIN.id) {
          setUser(ADMIN);
        } else if (token) {
          try {
            // Fetch live profile so room assignments are always current
            const me = await apiClient.get('/me');
            const rooms: string[] = me.rooms ?? [];
            setUser({
              id: me.username,
              name: me.username,
              email: me.username,
              password: '',
              role: me.role === 'admin' ? 'admin' : 'user',
              assignedCabinIds: roomsToCabinIds(rooms),
            });
          } catch (_) {
            // Token expired — force re-login
            await AsyncStorage.multiRemove([SESSION_KEY, TOKEN_STORAGE_KEY]);
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  // Any authenticated request that comes back 401 means the token has expired —
  // clear the session and drop the user so the app returns to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      AsyncStorage.multiRemove([SESSION_KEY, TOKEN_STORAGE_KEY]).catch(() => {});
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Attempt backend login. Use the email local-part as username.
    const username = email.includes('@') ? email.split('@')[0] : email;
    try {
      const resp = await apiClient.postForm('/login', { username, password });
      const token = resp.access_token;
      const role = resp.role ?? 'user';
      const rooms: string[] = resp.rooms ?? [];
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      await AsyncStorage.setItem(SESSION_KEY, username);
      const userObj: AppUser = {
        id: username,
        name: username,
        email: email.toLowerCase(),
        password: '',
        role: role === 'admin' ? 'admin' : 'user',
        assignedCabinIds: roomsToCabinIds(rooms),
      };
      setUser(userObj);
      return { success: true };
    } catch (e: any) {
      // A thrown Response means the server actually replied with a non-2xx status.
      if (e instanceof Response) {
        if (e.status === 401) {
          return { success: false, error: 'Invalid username or password.' };
        }
        let detail = '';
        try {
          const json = await e.json();
          detail = json.detail || '';
        } catch (_) {
          // response body wasn't JSON
        }
        return { success: false, error: detail || `Server error (${e.status}).` };
      }
      // Otherwise fetch itself rejected — network is unreachable, DNS/SSL/certificate
      // failure, or the tunnel URL is down. Surface the real cause instead of hiding it.
      return {
        success: false,
        error: `Cannot reach server (${getBaseUrlSync()}): ${e?.message || 'network/SSL error'}`,
      };
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  };

  // Sign in with the device's enrolled biometric key. Mirrors `login`'s side
  // effects (persist token + session, set user) on success.
  const biometricLogin = async (): Promise<{ success: boolean; error?: string; cancelled?: boolean }> => {
    try {
      const resp = await bioLogin();
      const username = resp.username;
      const role = resp.role ?? 'user';
      const rooms: string[] = resp.rooms ?? [];
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, resp.access_token);
      await AsyncStorage.setItem(SESSION_KEY, username);
      setUser({
        id: username,
        name: username,
        email: username,
        password: '',
        role: role === 'admin' ? 'admin' : 'user',
        assignedCabinIds: roomsToCabinIds(rooms),
      });
      return { success: true };
    } catch (e: any) {
      // Server replied non-2xx.
      if (e instanceof Response) {
        if (e.status === 404) {
          return { success: false, error: 'Biometric login isn’t set up for this device. Log in with your password to enable it.' };
        }
        let detail = '';
        try {
          detail = (await e.json())?.detail || '';
        } catch (_) {}
        return { success: false, error: detail || `Verification failed (${e.status}).` };
      }
      // A dismissed/failed Face ID or fingerprint prompt — not a real error.
      const msg = String(e?.message || '');
      if (/cancel|user_cancel|authentication was canceled|dismiss/i.test(msg)) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: msg || 'Biometric login failed.' };
    }
  };

  // Enroll the current user on this device (requires an active session/token).
  const enableBiometric = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Please log in first.' };
    try {
      await enrollBiometric(user.id);
      return { success: true };
    } catch (e: any) {
      if (e instanceof Response) {
        let detail = '';
        try {
          detail = (await e.json())?.detail || '';
        } catch (_) {}
        return { success: false, error: detail || `Couldn’t register key (${e.status}).` };
      }
      return { success: false, error: e?.message || 'Could not enable biometric login.' };
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Persist signup to backend. Use email local-part as username.
    const username = email.includes('@') ? email.split('@')[0] : email;
    try {
      const resp = await apiClient.postForm('/signup', { username, password });
      const token = resp.access_token;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      await AsyncStorage.setItem(SESSION_KEY, username);
      const newUser: AppUser = {
        id: username,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: '',
        role: 'user',
        assignedCabinIds: [],
      };
      setUser(newUser);
      return { success: true };
    } catch (err: any) {
      try {
        const json = await err.json();
        return { success: false, error: json.detail || 'Sign up failed.' };
      } catch (_) {
        return { success: false, error: 'Sign up failed.' };
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, signup, biometricLogin, enableBiometric, disableBiometric }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
