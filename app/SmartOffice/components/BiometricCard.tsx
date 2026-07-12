import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBiometricCapability, isEnrolledLocally } from '../api/biometric';

// Self-contained enable/disable control for biometric login on THIS device.
// Rendered both in admin Settings and in the Header modal so every user can reach it.
const BiometricCard: React.FC = () => {
  const { colors } = useTheme();
  const { enableBiometric, disableBiometric } = useAuth();
  const bc = useMemo(() => createBcStyles(colors), [colors]);

  const [available, setAvailable] = useState(false);
  const [label, setLabel] = useState('Biometrics');
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [cap, isEnrolled] = await Promise.all([
      getBiometricCapability(),
      isEnrolledLocally(),
    ]);
    setAvailable(cap.available);
    setLabel(cap.label);
    setEnrolled(isEnrolled);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggle = async () => {
    setBusy(true);
    if (enrolled) {
      await disableBiometric();
      setEnrolled(false);
    } else {
      const res = await enableBiometric();
      if (res.success) setEnrolled(true);
      else Alert.alert('Could not enable', res.error || 'Please try again.');
    }
    setBusy(false);
  };

  if (loading) return null;

  return (
    <View style={bc.card}>
      <View style={bc.cardHeader}>
        <View style={bc.cardIconWrap}>
          <Ionicons name="finger-print-outline" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bc.cardTitle}>{label} Login</Text>
          <Text style={bc.cardSub}>
            {!available
              ? 'No biometric hardware set up on this device'
              : enrolled
                ? `Enabled — sign in with ${label}`
                : `Sign in faster using ${label}`}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[bc.btn, enrolled ? bc.btnOff : bc.btnOn, (!available || busy) && bc.btnDisabled]}
        onPress={handleToggle}
        disabled={!available || busy}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator size="small" color={enrolled ? '#FF4D4D' : '#fff'} />
        ) : (
          <>
            <Ionicons
              name={enrolled ? 'close-circle-outline' : 'checkmark-circle-outline'}
              size={18}
              color={enrolled ? '#FF4D4D' : '#fff'}
            />
            <Text style={[bc.btnText, enrolled && bc.btnTextOff]}>
              {enrolled ? 'Disable on this device' : `Enable ${label}`}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const createBcStyles = (colors: ThemeColors) => StyleSheet.create({
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
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    height: 48, borderRadius: RADIUS.md,
  },
  btnOn: { backgroundColor: colors.accent },
  btnOff: { backgroundColor: 'rgba(255,77,77,0.08)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.3)' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnTextOff: { color: '#FF4D4D' },
});

export default BiometricCard;