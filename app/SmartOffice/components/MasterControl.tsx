import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { lightsOn, fansOn, allOff as apiAllOff } from '../api/devices';

interface MasterControlProps {
  onAllLightsOn: () => void;
  onAllFansOn: () => void;
  onAllOff: () => void;
}

const MasterControl: React.FC<MasterControlProps> = ({
  onAllLightsOn,
  onAllFansOn,
  onAllOff,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Master Control</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.btn} onPress={async () => { try { await lightsOn(); } catch (_) {} onAllLightsOn(); }} activeOpacity={0.7}>
          <Ionicons name="bulb" size={14} color={colors.accent} />
          <Text style={styles.btnText}>All Lights On</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={async () => { try { await fansOn(); } catch (_) {} onAllFansOn(); }} activeOpacity={0.7}>
          <Ionicons name="sync" size={14} color={colors.accent} />
          <Text style={styles.btnText}>All Fans On</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={async () => { try { await apiAllOff(); } catch (_) {} onAllOff(); }} activeOpacity={0.7}>
          <Ionicons name="power-outline" size={14} color="#fff" />
          <Text style={[styles.btnText, styles.btnTextDanger]}>All Off</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  title: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  buttons: {
    flexDirection: 'row',
  },

  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginRight: SPACING.xs, // replaces gap
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,122,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.2)',
  },

  btnDanger: {
    backgroundColor: 'rgba(255,80,80,0.15)',
    borderColor: 'rgba(255,80,80,0.25)',
  },

  btnText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4, // replaces gap
  },

  btnTextDanger: {
    color: '#fff',
  },
});

export default MasterControl;
