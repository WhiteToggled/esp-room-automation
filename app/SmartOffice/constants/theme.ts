export const darkColors = {
  background: '#0E0F14',
  surface: '#161820',
  surfaceLight: '#1E2028',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  accent: '#2F80ED',
  accentLight: '#5C9CF5',
  accentGlow: 'rgba(47,128,237,0.25)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.30)',
  toggleOff: 'rgba(255,255,255,0.15)',
  success: '#4ADE80',
  blue: '#60A5FA',
};

export const lightColors: typeof darkColors = {
  background: '#F4F5F8',
  surface: '#FFFFFF',
  surfaceLight: '#EFF0F4',
  glass: 'rgba(20,22,30,0.04)',
  glassBorder: 'rgba(20,22,30,0.09)',
  glassHighlight: 'rgba(20,22,30,0.12)',
  accent: '#2F80ED',
  accentLight: '#1D6FD8',
  accentGlow: 'rgba(47,128,237,0.16)',
  text: '#14161B',
  textSecondary: 'rgba(20,22,27,0.62)',
  textMuted: 'rgba(20,22,27,0.38)',
  toggleOff: 'rgba(20,22,30,0.14)',
  success: '#1FA15A',
  blue: '#2F7DE0',
};

export type ThemeColors = typeof darkColors;
export type ThemeMode = 'light' | 'dark';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  full: 999,
};
