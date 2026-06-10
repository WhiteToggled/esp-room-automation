import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { TOKEN_KEY } from '../constants/apiConfig';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  assignedCabinId: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  users: AppUser[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  assignCabin: (userId: string, cabinId: string | null) => Promise<void>;
}

const ADMIN: AppUser = {
  id: 'admin',
  name: 'Admin',
  email: 'admin@smartoffice.com',
  password: 'admin123',
  role: 'admin',
  assignedCabinId: null,
};

const USERS_KEY = 'smartoffice_users';
const SESSION_KEY = 'smartoffice_session';
const TOKEN_STORAGE_KEY = TOKEN_KEY;

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  users: [],
  login: async () => false,
  logout: async () => {},
  signup: async () => ({ success: false }),
  assignCabin: async () => {},
});

async function loadUsers(): Promise<AppUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveUsers(users: AppUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [id, list, token] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        loadUsers(),
        AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      ]);
      setUsers(list);
      if (id) {
        if (id === ADMIN.id) {
          setUser(ADMIN);
        } else if (token) {
          try {
            // Fetch live profile so room assignments are always current
            const me = await apiClient.get('/me');
            const rooms: string[] = me.rooms ?? [];
            const assignedCabinId = rooms[0]
              ? 'cabin-' + rooms[0].replace('r', '')
              : null;
            setUser({
              id: me.username,
              name: me.username,
              email: me.username,
              password: '',
              role: me.role === 'admin' ? 'admin' : 'user',
              assignedCabinId,
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

  const login = async (email: string, password: string): Promise<boolean> => {
    // Attempt backend login. Use the email local-part as username.
    const username = email.includes('@') ? email.split('@')[0] : email;
    try {
      const resp = await apiClient.postForm('/login', { username, password });
      const token = resp.access_token;
      const role = resp.role ?? 'user';
      const rooms: string[] = resp.rooms ?? [];
      const assignedCabinId = rooms[0] ? 'cabin-' + rooms[0].replace('r', '') : null;
      await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
      await AsyncStorage.setItem(SESSION_KEY, username);
      const userObj: AppUser = {
        id: username,
        name: username,
        email: email.toLowerCase(),
        password: '',
        role: role === 'admin' ? 'admin' : 'user',
        assignedCabinId,
      };
      setUser(userObj);
      return true;
    } catch (e) {
      return false;
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
        assignedCabinId: null,
      };
      const list = await loadUsers();
      const updated = [...list, newUser];
      await saveUsers(updated);
      setUsers(updated);
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

  const assignCabin = async (userId: string, cabinId: string | null): Promise<void> => {
    const list = await loadUsers();
    const updated = list.map((u) =>
      u.id === userId ? { ...u, assignedCabinId: cabinId } : u
    );
    await saveUsers(updated);
    setUsers(updated);
    // Update current session if the assigned user is logged in
    if (user?.id === userId) {
      setUser((prev) => prev ? { ...prev, assignedCabinId: cabinId } : prev);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, users, login, logout, signup, assignCabin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
