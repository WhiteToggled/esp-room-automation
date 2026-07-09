import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setUnauthorizedHandler } from '../api/client';
import { getBaseUrlSync, TOKEN_KEY } from '../constants/apiConfig';

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
    <AuthContext.Provider value={{ user, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
