import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, TouchableWithoutFeedback, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Cabin } from '../constants/cabinData';
import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import ToggleSwitch from './ToggleSwitch';

interface ExpandedCabinModalProps {
  cabin: Cabin | null;
  canRename?: boolean;
  onClose: () => void;
  onToggleLight: () => void;
  onToggleFan: () => void;
  onRename?: (name: string) => void;
}

const ExpandedCabinModal: React.FC<ExpandedCabinModalProps> = ({
  cabin,
  canRename = false,
  onClose,
  onToggleLight,
  onToggleFan,
  onRename,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Kept mounted through the exit animation, then torn down. Separate from the
  // `cabin` prop so the card can animate out before the parent clears it.
  const [render, setRender] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Animate in whenever a cabin is opened (or a different one is swapped in).
  useEffect(() => {
    if (cabin) {
      setRender(true);
      setEditing(false); // never reopen mid-edit for a different cabin
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 220 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [cabin?.id]);

  // Play the exit animation first, then actually close (parent clears the cabin).
  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.9, duration: 160, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setRender(false);
        onClose();
      }
    });
  };

  const startEditing = () => {
    if (!cabin) return;
    setDraft(cabin.name);
    setEditing(true);
  };

  const commitRename = () => {
    const name = draft.trim();
    if (name && name !== cabin?.name) onRename?.(name);
    setEditing(false);
  };

  const isAnyOn = !!cabin && (cabin.light.isOn || cabin.fan.isOn);

  return (
    <Modal transparent animationType="none" visible={render} onRequestClose={handleClose}>
      {/* Tapping the dimmed backdrop closes; taps on the card are swallowed. */}
      <TouchableWithoutFeedback accessible={false} onPress={handleClose}>
      <Animated.View style={[styles.overlay, { opacity }]}>
        {cabin && (
          <TouchableWithoutFeedback accessible={false} onPress={() => {}}>
          <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cabin.number}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {editing ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Cabin name"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={commitRename}
                  selectionColor={colors.accent}
                />
                <TouchableOpacity style={styles.nameSaveBtn} onPress={commitRename} activeOpacity={0.7}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.nameCancelBtn} onPress={() => setEditing(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{cabin.name}</Text>
                {canRename && (
                  <TouchableOpacity style={styles.renameBtn} onPress={startEditing} activeOpacity={0.7}>
                    <Ionicons name="pencil" size={14} color={colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
            )}
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
          </TouchableWithoutFeedback>
        )}
      </Animated.View>
      </TouchableWithoutFeedback>
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
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, flexShrink: 1 },
  renameBtn: {
    width: 30, height: 30, borderRadius: 9, marginLeft: SPACING.sm,
    backgroundColor: 'rgba(47,128,237,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  nameInput: {
    flex: 1, color: colors.text, fontSize: 20, fontWeight: '700',
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.accent,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  nameSaveBtn: {
    width: 40, height: 40, borderRadius: 11, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  nameCancelBtn: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
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
