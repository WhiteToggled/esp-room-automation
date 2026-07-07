import React, { useState, useMemo } from 'react';
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

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FadeInView from '../components/FadeInView';

const SignupScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await signup(name.trim(), email.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? 'Sign up failed.');
    }
    // NavigationGuard in _layout handles redirect to home on success
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

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
            {/* Back button */}
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Hero */}
            <FadeInView distance={20} duration={500}>
              <View style={styles.hero}>
                <View style={styles.logoCircle}>
                  <Ionicons name="person-add" size={28} color={colors.accent} />
                </View>
                <Text style={styles.appName}>Create Account</Text>
                <Text style={styles.tagline}>Sign up to access your cabin controls</Text>
              </View>
            </FadeInView>

            {/* Card */}
            <FadeInView distance={20} duration={500} delay={120}>
            <View style={styles.card}>
              {/* Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={[styles.inputWrapper, !!error && !name.trim() && styles.inputError]}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="John Doe"
                    placeholderTextColor={colors.textMuted}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(''); }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.inputWrapper, !!error && !email.trim() && styles.inputError]}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
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
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 4 characters"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={[styles.inputWrapper, !!error && password !== confirmPassword && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                </View>
              </View>

              {/* Error */}
              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={14} color="#FF4D4D" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Info banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={15} color={colors.accent} />
                <Text style={styles.infoText}>
                  After signing up, an admin will assign a cabin to your account.
                </Text>
              </View>

              {/* Sign Up button */}
              <TouchableOpacity
                style={[styles.signUpBtn, loading && styles.btnDisabled]}
                onPress={handleSignup}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.signUpText}>Create Account</Text>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              {/* Back to login */}
              <TouchableOpacity style={styles.loginLink} onPress={() => router.back()}>
                <Text style={styles.loginLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.loginLinkAccent}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
            </FadeInView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
  },
  glowTopLeft: {
    position: 'absolute', top: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(47,128,237,0.08)',
  },
  glowBottomRight: {
    position: 'absolute', bottom: -60, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.05)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  hero: { alignItems: 'center', marginBottom: SPACING.xl },
  logoCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: { color: colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  tagline: { color: colors.textSecondary, fontSize: 13, fontWeight: '300', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.xl, padding: SPACING.xl,
  },
  fieldGroup: { marginBottom: SPACING.md },
  label: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '500',
    marginBottom: SPACING.xs, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, height: 50,
  },
  inputError: { borderColor: 'rgba(255,77,77,0.5)' },
  inputIcon: { marginRight: SPACING.xs },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  eyeBtn: { padding: SPACING.xs },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  errorText: { color: '#FF4D4D', fontSize: 13, marginLeft: SPACING.xs },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(47,128,237,0.08)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.2)',
    borderRadius: RADIUS.md, padding: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  infoText: {
    color: colors.textSecondary, fontSize: 12,
    flex: 1, marginLeft: SPACING.xs, lineHeight: 18,
  },
  signUpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: RADIUS.md,
    height: 52,
  },
  btnDisabled: { opacity: 0.6 },
  signUpText: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: SPACING.xs },
  loginLink: { alignItems: 'center', marginTop: SPACING.lg },
  loginLinkText: { color: colors.textMuted, fontSize: 13 },
  loginLinkAccent: { color: colors.accent, fontWeight: '600' },
});

export default SignupScreen;
