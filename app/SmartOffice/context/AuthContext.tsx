import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const [id, list] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        loadUsers(),
      ]);
      setUsers(list);
      if (id) {
        const found =
          id === ADMIN.id
            ? ADMIN
            : (list.find((u) => u.id === id) ?? null);
        setUser(found);
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const list = await loadUsers();
    setUsers(list);

    let found: AppUser | null = null;
    if (
      ADMIN.email.toLowerCase() === email.toLowerCase() &&
      ADMIN.password === password
    ) {
      found = ADMIN;
    } else {
      found = list.find(
        (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      ) ?? null;
    }
    if (!found) return false;
    await AsyncStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
    return true;
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  const signup = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const list = await loadUsers();
    const emailTaken =
      email.toLowerCase() === ADMIN.email.toLowerCase() ||
      list.some((u) => u.email.toLowerCase() === email.toLowerCase());
    if (emailTaken) return { success: false, error: 'Email is already registered.' };

    const newUser: AppUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'user',
      assignedCabinId: null,
    };
    const updated = [...list, newUser];
    await saveUsers(updated);
    setUsers(updated);
    await AsyncStorage.setItem(SESSION_KEY, newUser.id);
    setUser(newUser);
    return { success: true };
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
