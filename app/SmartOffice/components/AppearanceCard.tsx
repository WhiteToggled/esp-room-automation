import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const THEME_OPTIONS: { key: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

// Theme (light/dark/system) selector — shared by admin Settings and User Settings.
const AppearanceCard: React.FC = () => {
  const { colors, preference, setPreference } = useTheme();
  const ap = useMemo(() => createApStyles(colors), [colors]);

  return (
    <View style={ap.card}>
      <View style={ap.cardHeader}>
        <View style={ap.cardIconWrap}>
          <Ionicons name="contrast-outline" size={18} color={colors.accent} />
        </View>
        <View>
          <Text style={ap.cardTitle}>Appearance</Text>
          <Text style={ap.cardSub}>Choose how Nestboard looks</Text>
        </View>
      </View>

      <View style={ap.optionsRow}>
        {THEME_OPTIONS.map((opt) => {
          const active = preference === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[ap.option, active && ap.optionActive]}
              onPress={() => setPreference(opt.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={opt.icon} size={18} color={active ? colors.accent : colors.textMuted} />
              <Text style={[ap.optionText, active && ap.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createApStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xl,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, gap: SPACING.md },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(47,128,237,0.12)', borderWidth: 1, borderColor: 'rgba(47,128,237,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSub:   { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  optionsRow: { flexDirection: 'row', gap: SPACING.sm },
  option: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceLight,
  },
  optionActive: { borderColor: 'rgba(47,128,237,0.4)', backgroundColor: 'rgba(47,128,237,0.1)' },
  optionText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: colors.accent },
});

export default AppearanceCard;