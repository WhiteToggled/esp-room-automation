import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import ToggleSwitch from './ToggleSwitch';
import FadeInView from './FadeInView';
import { Cabin } from '../constants/cabinData';
import { SPACING, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface CabinCardProps {
  cabin: Cabin;
  index?: number;
  // Renders a bigger, full-width card — used when a user has a single cabin.
  large?: boolean;
  onToggleLight: (cabinId: string) => void;
  onToggleFan: (cabinId: string) => void;
  onExpand: (cabinId: string) => void;
}

// Brief scale "pop" on an icon wrap whenever a device flips on/off, skipping the initial mount.
const usePulseOnChange = (value: boolean) => {
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 180 }),
    ]).start();
  }, [value]);

  return scale;
};

const CabinCard: React.FC<CabinCardProps> = ({
  cabin,
  index = 0,
  large = false,
  onToggleLight,
  onToggleFan,
  onExpand,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, large), [colors, large]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Each unreachable device disables its own toggle; the whole cabin is only
  // greyed out and locked when BOTH devices are offline.
  const lightOffline = !cabin.light.isOnline;
  const fanOffline = !cabin.fan.isOnline;
  const isOffline = lightOffline && fanOffline;
  const isAnyOn = cabin.light.isOn || cabin.fan.isOn;
  const iconSize = large ? 20 : 14;

  const lightPulse = usePulseOnChange(cabin.light.isOn);
  const fanPulse = usePulseOnChange(cabin.fan.isOn);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      damping: 20,
      stiffness: 300,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  };

  return (
    <FadeInView delay={Math.min(index, 8) * 60} distance={16} style={styles.wrapper}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <GlassCard style={[styles.card, isOffline && styles.cardOffline]} highlighted={(isAnyOn && !isOffline) as boolean}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.cabinBadge}>
              <Text style={styles.cabinNumber}>{cabin.number}</Text>
            </View>

            {/* The big single-cabin card shows controls inline, so no expand shortcut. */}
            {!large && (
              <TouchableOpacity
                onPress={() => onExpand(cabin.id)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.expandBtn}
                // A fully-offline (greyed) cabin can't be opened.
                disabled={isOffline}
              >
                <Ionicons name="expand-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Name */}
          <Text style={styles.cabinName}>{cabin.name}</Text>

          {/* Status — offline (device unreachable) takes precedence over Active/Idle */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isOffline ? styles.statusDotOffline : isAnyOn ? styles.statusDotOn : styles.statusDotOff,
              ]}
            />
            <Text style={[styles.statusText, isOffline && styles.statusTextOffline]}>
              {isOffline ? 'Offline' : isAnyOn ? 'Active' : 'Idle'}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Light */}
          <View style={styles.deviceRow}>
            <View style={styles.deviceLeft}>
              <Animated.View style={[styles.iconWrap, cabin.light.isOn && styles.iconWrapOn, { transform: [{ scale: lightPulse }] }]}>
                <Ionicons
                  name="bulb-outline"
                  size={iconSize}
                  color={cabin.light.isOn ? colors.accent : colors.textMuted}
                />
              </Animated.View>
              <Text style={[styles.deviceLabel, cabin.light.isOn && styles.deviceLabelOn]}>
                Light
              </Text>
            </View>
            <ToggleSwitch isOn={cabin.light.isOn} onToggle={() => onToggleLight(cabin.id)} size={large ? 'md' : 'sm'} disabled={lightOffline} />
          </View>

          {/* Fan */}
          <View style={[styles.deviceRow, styles.fanRow]}>
            <View style={styles.deviceLeft}>
              <Animated.View style={[styles.iconWrap, cabin.fan.isOn && styles.iconWrapOn, { transform: [{ scale: fanPulse }] }]}>
                <Ionicons
                  name="sync-outline"
                  size={iconSize}
                  color={cabin.fan.isOn ? colors.accent : colors.textMuted}
                />
              </Animated.View>
              <Text style={[styles.deviceLabel, cabin.fan.isOn && styles.deviceLabelOn]}>
                Fan
              </Text>
            </View>
            <ToggleSwitch isOn={cabin.fan.isOn} onToggle={() => onToggleFan(cabin.id)} size={large ? 'md' : 'sm'} disabled={fanOffline} />
          </View>
        </GlassCard>
      </Animated.View>
    </FadeInView>
  );
};

const createStyles = (colors: ThemeColors, large: boolean) => StyleSheet.create<{
  wrapper: ViewStyle;
  card: ViewStyle;
  cardOffline: ViewStyle;
  header: ViewStyle;
  cabinBadge: ViewStyle;
  cabinNumber: TextStyle;
  expandBtn: ViewStyle;
  cabinName: TextStyle;
  statusRow: ViewStyle;
  statusDot: ViewStyle;
  statusDotOn: ViewStyle;
  statusDotOff: ViewStyle;
  statusDotOffline: ViewStyle;
  statusText: TextStyle;
  statusTextOffline: TextStyle;
  divider: ViewStyle;
  deviceRow: ViewStyle;
  fanRow: ViewStyle;
  deviceLeft: ViewStyle;
  iconWrap: ViewStyle;
  iconWrapOn: ViewStyle;
  deviceLabel: TextStyle;
  deviceLabelOn: TextStyle;
}>({
  wrapper: large
    ? { width: '100%', marginBottom: SPACING.md }
    : { flex: 1, margin: SPACING.sm / 2 },
  card: {
    padding: large ? SPACING.xl : SPACING.md,
    minHeight: large ? 300 : 170,
  },
  // Greyed-out treatment when the cabin has an unreachable device.
  cardOffline: {
    opacity: 0.45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cabinBadge: {
    width: large ? 40 : 28,
    height: large ? 40 : 28,
    borderRadius: large ? 12 : 8,
    backgroundColor: colors.glassHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinNumber: {
    color: colors.textSecondary,
    fontSize: large ? 15 : 11,
    fontWeight: '600',
  },
  expandBtn: {
    width: large ? 34 : 24,
    height: large ? 34 : 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: large ? 10 : 6,
  },
  cabinName: {
    color: colors.text,
    fontSize: large ? 24 : 15,
    fontWeight: large ? '700' : '600',
    letterSpacing: large ? -0.5 : 0,
    marginTop: large ? 10 : 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: large ? SPACING.md : SPACING.sm,
  },
  statusDot: {
    width: large ? 8 : 6,
    height: large ? 8 : 6,
    borderRadius: large ? 4 : 3,
    marginRight: 5,
  },
  statusDotOn: {
    backgroundColor: colors.accent,
  },
  statusDotOff: {
    backgroundColor: colors.textMuted,
  },
  statusDotOffline: {
    backgroundColor: colors.warning,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: large ? 11 : 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusTextOffline: {
    color: colors.warning,
  },
  divider: {
    height: 1,
    backgroundColor: colors.glassBorder,
    marginBottom: large ? SPACING.lg : SPACING.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(large
      ? {
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: 12,
          padding: SPACING.md,
        }
      : null),
  },
  fanRow: { marginTop: large ? SPACING.md : SPACING.sm },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: large ? 34 : 22,
    height: large ? 34 : 22,
    borderRadius: large ? 10 : 6,
    marginRight: large ? 10 : 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: large ? 'rgba(255,255,255,0.05)' : 'transparent',
  },
  iconWrapOn: {
    backgroundColor: 'rgba(47,128,237,0.15)',
  },
  deviceLabel: {
    color: colors.textMuted,
    fontSize: large ? 16 : 12,
    fontWeight: large ? '600' : '400',
  },
  deviceLabelOn: {
    color: large ? colors.text : colors.textSecondary,
  },
});

export default memo(CabinCard);
