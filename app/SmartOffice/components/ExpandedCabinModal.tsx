import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Cabin } from '../constants/cabinData';
import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import ToggleSwitch from './ToggleSwitch';

interface ExpandedCabinModalProps {
  cabin: Cabin | null;
  onClose: () => void;
  onToggleLight: () => void;
  onToggleFan: () => void;
}

const ExpandedCabinModal: React.FC<ExpandedCabinModalProps> = ({
  cabin,
  onClose,
  onToggleLight,
  onToggleFan,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cabin) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [cabin?.id]);

  const isAnyOn = !!cabin && (cabin.light.isOn || cabin.fan.isOn);

  return (
    <Modal transparent animationType="fade" visible={!!cabin} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {cabin && (
          <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cabin.number}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.name}>{cabin.name}</Text>
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
                    size={22}
                    color={cabin.light.isOn ? colors.accent : colors.textMuted}
                  />
                </View>
                <Text style={[styles.deviceLabel, cabin.light.isOn && styles.deviceLabelOn]}>Light</Text>
              </View>
              <ToggleSwitch isOn={cabin.light.isOn} onToggle={onToggleLight} />
            </View>

            {/* Fan */}
            <View style={[styles.deviceRow, { marginTop: SPACING.lg }]}>
              <View style={styles.deviceLeft}>
                <View style={[styles.iconWrap, cabin.fan.isOn && styles.iconWrapOn]}>
                  <Ionicons
                    name="sync-outline"
                    size={22}
                    color={cabin.fan.isOn ? colors.accent : colors.textMuted}
                  />
                </View>
                <Text style={[styles.deviceLabel, cabin.fan.isOn && styles.deviceLabelOn]}>Fan</Text>
              </View>
              <ToggleSwitch isOn={cabin.fan.isOn} onToggle={onToggleFan} />
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  badge: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: colors.glassHighlight,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, marginBottom: SPACING.lg },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  statusDotOn: { backgroundColor: colors.accent },
  statusDotOff: { backgroundColor: colors.textMuted },
  statusText: { color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: colors.glassBorder, marginBottom: SPACING.lg },
  deviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    marginRight: SPACING.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconWrapOn: { backgroundColor: 'rgba(47,128,237,0.15)' },
  deviceLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  deviceLabelOn: { color: colors.text },
});

export default ExpandedCabinModal;
