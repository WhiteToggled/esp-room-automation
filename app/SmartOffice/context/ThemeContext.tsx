import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, ThemeColors, ThemeMode } from '../constants/theme';

type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
  colors: ThemeColors;
  theme: ThemeMode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'nestboard_theme_pref';

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  theme: 'dark',
  preference: 'system',
  setPreference: () => {},
  toggleTheme: () => {},
});

export const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    })();
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  };

  const theme: ThemeMode = preference === 'system' ? (deviceScheme === 'light' ? 'light' : 'dark') : preference;
  const colors = theme === 'light' ? lightColors : darkColors;

  const toggleTheme = () => setPreference(theme === 'dark' ? 'light' : 'dark');

  const value = useMemo(
    () => ({ colors, theme, preference, setPreference, toggleTheme }),
    [colors, theme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
