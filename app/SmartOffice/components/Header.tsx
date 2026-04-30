import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

interface HeaderProps {
  activeDevices: number;
  totalDevices: number;
}

const Header: React.FC<HeaderProps> = ({ activeDevices, totalDevices }) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>Smart Room</Text>
          <Text style={styles.subtitle}>Control Panel</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textSecondary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="person-circle-outline" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
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
          <Ionicons name="grid-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.statText}>8 Cabins</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
  },

  subtitle: {
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm, // ✅ replaces gap
    position: 'relative',
  },

  notifDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },

  statsRow: {
    flexDirection: 'row',
  },

  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: SPACING.sm, // instead of gap
  },

  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginRight: SPACING.xs,
  },

  statText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
});

export default Header;