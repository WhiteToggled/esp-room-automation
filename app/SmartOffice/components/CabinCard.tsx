import React, { useRef } from 'react';
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
import { Cabin } from '../constants/cabinData';
import { COLORS, SPACING } from '../constants/theme';

interface CabinCardProps {
  cabin: Cabin;
  onToggleLight: () => void;
  onToggleFan: () => void;
  onPress: () => void;
}

const CabinCard: React.FC<CabinCardProps> = ({
  cabin,
  onToggleLight,
  onToggleFan,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isAnyOn = cabin.light.isOn || cabin.fan.isOn;

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
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <GlassCard style={styles.card} highlighted={isAnyOn as boolean}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.cabinBadge}>
            <Text style={styles.cabinNumber}>{cabin.number}</Text>
          </View>

          <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.expandBtn}
          >
            <Ionicons name="expand-outline" size={14} color={COLORS.textSecondary} />
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
            <View style={[styles.iconWrap, cabin.light.isOn && styles.iconWrapOn]}>
              <Ionicons
                name="bulb-outline"
                size={14}
                color={cabin.light.isOn ? COLORS.accent : COLORS.textMuted}
              />
            </View>
            <Text style={[styles.deviceLabel, cabin.light.isOn && styles.deviceLabelOn]}>
              Light
            </Text>
          </View>
          <ToggleSwitch isOn={cabin.light.isOn} onToggle={onToggleLight} size="sm" />
        </View>

        {/* Fan */}
        <View style={[styles.deviceRow, { marginTop: SPACING.sm }]}>
          <View style={styles.deviceLeft}>
            <View style={[styles.iconWrap, cabin.fan.isOn && styles.iconWrapOn]}>
              <Ionicons
                name="sync-outline"
                size={14}
                color={cabin.fan.isOn ? COLORS.accent : COLORS.textMuted}
              />
            </View>
            <Text style={[styles.deviceLabel, cabin.fan.isOn && styles.deviceLabelOn]}>
              Fan
            </Text>
          </View>
          <ToggleSwitch isOn={cabin.fan.isOn} onToggle={onToggleFan} size="sm" />
        </View>
      </GlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create<{
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabinNumber: {
    color: COLORS.textSecondary,
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
    color: COLORS.text,
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
    backgroundColor: COLORS.accent,
  },
  statusDotOff: {
    backgroundColor: COLORS.textMuted,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,122,0,0.15)',
  },
  deviceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  deviceLabelOn: {
    color: COLORS.textSecondary,
  },
});

export default CabinCard;