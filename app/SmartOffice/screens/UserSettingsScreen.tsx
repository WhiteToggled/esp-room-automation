import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SPACING, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import AppearanceCard from '../components/AppearanceCard';
import BiometricCard from '../components/BiometricCard';

// Settings for regular (non-admin) users: appearance + biometric login only.
const UserSettingsScreen: React.FC = () => {
  const { colors, theme } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={s.glowTR} />

      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
          <Text style={s.subtitle}>Preferences</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollBody}>
          <AppearanceCard />
          <BiometricCard />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  glowTR: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.07)',
  },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  title:    { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  scrollBody: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
});

export default UserSettingsScreen;