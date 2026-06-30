import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { changePassword } from '../api/devices';

interface ChangePasswordModalProps {
  visible: boolean;
  username: string;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ visible, username, onClose }) => {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reset = () => {
    setNewPassword(''); setConfirmPassword('');
    setError(''); setSuccess(''); setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (newPassword.length < 4) { setError('New password must be at least 4 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }

    setError(''); setSuccess(''); setLoading(true);
    try {
      await changePassword(username, newPassword);
      setSuccess('Password updated successfully.');
      setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      try {
        const json = await e.json();
        setError(json.detail ?? 'Failed to change password.');
      } catch (_) {
        setError('Failed to change password.');
      }
    }
    setLoading(false);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <View>
              <Text style={s.title}>Reset Password</Text>
              <Text style={s.subtitle}>{username}</Text>
            </View>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>NEW PASSWORD</Text>
              <View style={[s.inputWrap, !!error && s.inputError]}>
                <Ionicons name="key-outline" size={16} color={colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Min. 4 characters"
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setError(''); setSuccess(''); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>CONFIRM NEW PASSWORD</Text>
              <View style={[s.inputWrap, !!error && s.inputError]}>
                <Ionicons name="key-outline" size={16} color={colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(''); setSuccess(''); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!!error && (
              <View style={s.feedbackRow}>
                <Ionicons name="alert-circle-outline" size={13} color="#FF4D4D" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}
            {!!success && (
              <View style={s.feedbackRow}>
                <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
                <Text style={s.successText}>{success}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.submitBtn, loading && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>Update Password</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.glassBorder,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: colors.glassBorder,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: SPACING.xl },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: SPACING.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, height: 48,
  },
  inputError: { borderColor: 'rgba(255,77,77,0.5)' },
  inputIcon: { marginRight: SPACING.xs },
  input: { flex: 1, color: colors.text, fontSize: 14 },
  eyeBtn: { padding: SPACING.xs },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  errorText:   { color: '#FF4D4D', fontSize: 12 },
  successText: { color: colors.success, fontSize: 12 },
  submitBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: RADIUS.md, height: 48, marginTop: SPACING.xs,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default ChangePasswordModal;
