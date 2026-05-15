import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    const success = await login(email.trim(), password);
    setLoading(false);
    if (!success) {
      setError('Invalid email or password.');
    }
    // Navigation handled by _layout NavigationGuard on user state change
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.hero}>
              <View style={styles.logoCircle}>
                <Ionicons name="flash" size={32} color={COLORS.accent} />
              </View>
              <Text style={styles.appName}>SmartOffice</Text>
              <Text style={styles.tagline}>Room Automation System</Text>
            </View>

            {/* Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputWrapper, !!error && styles.inputError]}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(''); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputWrapper, !!error && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textMuted}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#FF4D4D" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Sign In button */}
              <TouchableOpacity
                style={[styles.signInBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.signInText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Sign Up link */}
              <TouchableOpacity
                style={styles.signUpBtn}
                onPress={() => router.push('/signup')}
                activeOpacity={0.8}
              >
                <Text style={styles.signUpText}>Create an account</Text>
              </TouchableOpacity>

              <Text style={styles.adminHint}>Admin: admin@smartoffice.com</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  glowTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,122,0,0.08)',
  },
  glowBottomLeft: {
    position: 'absolute', bottom: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,122,0,0.05)',
  },
  hero: { alignItems: 'center', marginBottom: SPACING.xxxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,122,0,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,122,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: { color: COLORS.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  tagline: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '300', marginTop: 4 },
  card: {
    backgroundColor: COLORS.glass,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.xl, padding: SPACING.xl,
  },
  cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
  cardSubtitle: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.xl },
  fieldGroup: { marginBottom: SPACING.md },
  label: {
    color: COLORS.textSecondary, fontSize: 12, fontWeight: '500',
    marginBottom: SPACING.xs, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, height: 50,
  },
  inputError: { borderColor: 'rgba(255,77,77,0.5)' },
  inputIcon: { marginRight: SPACING.xs },
  input: { flex: 1, color: COLORS.text, fontSize: 15 },
  eyeBtn: { padding: SPACING.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  errorText: { color: '#FF4D4D', fontSize: 13, marginLeft: SPACING.xs },
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md,
    height: 52, marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.6 },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: SPACING.xs },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.glassBorder },
  dividerText: { color: COLORS.textMuted, fontSize: 12, marginHorizontal: SPACING.sm },
  signUpBtn: {
    height: 52, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  signUpText: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  adminHint: {
    color: COLORS.textMuted, fontSize: 11,
    textAlign: 'center', marginTop: SPACING.lg,
  },
});

export default LoginScreen;
