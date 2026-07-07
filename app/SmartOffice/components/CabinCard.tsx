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
  onToggleLight,
  onToggleFan,
  onExpand,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAnyOn = cabin.light.isOn || cabin.fan.isOn;

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
        <GlassCard style={styles.card} highlighted={isAnyOn as boolean}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.cabinBadge}>
              <Text style={styles.cabinNumber}>{cabin.number}</Text>
            </View>

            <TouchableOpacity
              onPress={() => onExpand(cabin.id)}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.expandBtn}
            >
              <Ionicons name="expand-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Name */}
          <Text style={styles.cabinName}>{cabin.name}</Text>

          {/* Status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isAnyOn ? styles.statusDotOn : styles.statusDotOff]} />
            <Text style={styles.statusText}>{isAnyOn ? 'Active' : 'Idle'}</Text>
          </View>

          <View style={styles.divider} />

          {/* Light */}
          <View style={styles.deviceRow}>
            <View style={styles.deviceLeft}>
              <Animated.View style={[styles.iconWrap, cabin.light.isOn && styles.iconWrapOn, { transform: [{ scale: lightPulse }] }]}>
                <Ionicons
                  name="bulb-outline"
                  size={14}
                  color={cabin.light.isOn ? colors.accent : colors.textMuted}
                />
              </Animated.View>
              <Text style={[styles.deviceLabel, cabin.light.isOn && styles.deviceLabelOn]}>
                Light
              </Text>
            </View>
            <ToggleSwitch isOn={cabin.light.isOn} onToggle={() => onToggleLight(cabin.id)} size="sm" />
          </View>

          {/* Fan */}
          <View style={[styles.deviceRow, { marginTop: SPACING.sm }]}>
            <View style={styles.deviceLeft}>
              <Animated.View style={[styles.iconWrap, cabin.fan.isOn && styles.iconWrapOn, { transform: [{ scale: fanPulse }] }]}>
                <Ionicons
                  name="sync-outline"
                  size={14}
                  color={cabin.fan.isOn ? colors.accent : colors.textMuted}
                />
              </Animated.View>
              <Text style={[styles.deviceLabel, cabin.fan.isOn && styles.deviceLabelOn]}>
                Fan
              </Text>
            </View>
            <ToggleSwitch isOn={cabin.fan.isOn} onToggle={() => onToggleFan(cabin.id)} size="sm" />
          </View>
        </GlassCard>
      </Animated.View>
    </FadeInView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create<{
  wrapper: ViewStyle;
  card: ViewStyle;
  header: ViewStyle;
  cabinBadge: ViewStyle;
  cabinNumber: TextStyle;
  expandBtn: ViewStyle;
  cabinName: TextStyle;
  statusRow: ViewStyle;
  statusDot: ViewStyle;
  statusDotOn: ViewStyle;
  statusDotOff: ViewStyle;
  statusText: TextStyle;
  divider: ViewStyle;
  deviceRow: ViewStyle;
  deviceLeft: ViewStyle;
  iconWrap: ViewStyle;
  iconWrapOn: ViewStyle;
  deviceLabel: TextStyle;
  deviceLabelOn: TextStyle;
}>({
  wrapper: {
    flex: 1,
    margin: SPACING.sm / 2,
  },
  card: {
    padding: SPACING.md,
    minHeight: 170,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cabinBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.glassHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinNumber: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  expandBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  cabinName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusDotOn: {
    backgroundColor: colors.accent,
  },
  statusDotOff: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: colors.glassBorder,
    marginBottom: SPACING.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: 'rgba(47,128,237,0.15)',
  },
  deviceLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deviceLabelOn: {
    color: colors.textSecondary,
  },
});

export default memo(CabinCard);
