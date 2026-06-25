import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import AcknowledgementsModal from './AcknowledgementsModal';

interface HeaderProps {
  activeDevices: number;
  totalDevices: number;
  userName?: string;
  cabinCount?: number;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeDevices,
  totalDevices,
  userName,
  cabinCount = 8,
  onLogout,
}) => {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [ackVisible, setAckVisible] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>Smart Room</Text>
          <Text style={styles.subtitle}>
            {userName ? `Welcome, ${userName}` : 'Control Panel'}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setAckVisible(true)} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleTheme} activeOpacity={0.7}>
            <Ionicons
              name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {onLogout ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <View style={styles.statDot} />
          <Text style={styles.statText}>
            {activeDevices} of {totalDevices} devices on
          </Text>
        </View>

        <View style={styles.statChip}>
          <Ionicons name="grid-outline" size={12} color={colors.textMuted} />
          <Text style={styles.statText}>{cabinCount} Cabin{cabinCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <AcknowledgementsModal visible={ackVisible} onClose={() => setAckVisible(false)} insets={insets} />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },

  greeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
  },

  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '300',
    marginTop: 2,
  },

  actions: {
    flexDirection: 'row',
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    position: 'relative',
  },

  statsRow: {
    flexDirection: 'row',
  },

  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: SPACING.sm,
  },

  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: SPACING.xs,
  },

  statText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
});

export default Header;
