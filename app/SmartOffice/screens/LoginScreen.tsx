import React, { useState, useMemo, useEffect } from 'react';
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
import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import FadeInView from '../components/FadeInView';
import { getBaseUrl, setBaseUrl } from '../constants/apiConfig';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Runtime-configurable server URL
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [urlSaved, setUrlSaved] = useState(false);

  const { login } = useAuth();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Load the currently active server URL into the editable field.
  useEffect(() => {
    getBaseUrl().then(setServerUrl).catch(() => {});
  }, []);

  const handleSaveUrl = async () => {
    const normalized = await setBaseUrl(serverUrl);
    setServerUrl(normalized);
    setError('');
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid username or password.');
    }
    // Navigation handled by _layout NavigationGuard on user state change
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
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
            <FadeInView distance={20} duration={500}>
              <View style={styles.hero}>
                <View style={styles.logoCircle}>
                  <Ionicons name="flash" size={32} color={colors.accent} />
                </View>
                <Text style={styles.appName}>Nestboard</Text>
                <Text style={styles.tagline}>Room Automation System</Text>
              </View>
            </FadeInView>

            {/* Card */}
            <FadeInView distance={20} duration={500} delay={120}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>Enter your credentials to continue</Text>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Username</Text>
                <View style={[styles.inputWrapper, !!error && styles.inputError]}>
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
                <View style={[styles.inputWrapper, !!error && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
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
                      color={colors.textMuted}
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

              <Text style={styles.adminHint}>Contact your admin for account access.</Text>

              {/* Server URL config */}
              <TouchableOpacity
                style={styles.serverToggle}
                onPress={() => setShowServerConfig((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons name="server-outline" size={14} color={colors.textMuted} />
                <Text style={styles.serverToggleText}>Server settings</Text>
                <Ionicons
                  name={showServerConfig ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {showServerConfig && (
                <View style={styles.serverConfig}>
                  <Text style={styles.label}>Server URL</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="link-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="https://example.com or 192.168.0.127:8000"
                      placeholderTextColor={colors.textMuted}
                      value={serverUrl}
                      onChangeText={setServerUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="done"
                      onSubmitEditing={handleSaveUrl}
                    />
                  </View>
                  <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveUrl} activeOpacity={0.8}>
                    <Ionicons
                      name={urlSaved ? 'checkmark-circle' : 'save-outline'}
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.saveUrlText}>{urlSaved ? 'Saved' : 'Save & use'}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxxl,
  },
  glowTopRight: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.08)',
  },
  glowBottomLeft: {
    position: 'absolute', bottom: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(47,128,237,0.05)',
  },
  hero: { alignItems: 'center', marginBottom: SPACING.xxxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.8 },
  tagline: { color: colors.textSecondary, fontSize: 13, fontWeight: '300', marginTop: 4 },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.xl, padding: SPACING.xl,
  },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
  cardSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: SPACING.xl },
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
  signInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: RADIUS.md,
    height: 52, marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.6 },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: SPACING.xs },
  adminHint: {
    color: colors.textMuted, fontSize: 11,
    textAlign: 'center', marginTop: SPACING.lg,
  },
  serverToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.lg, paddingVertical: SPACING.xs,
  },
  serverToggleText: {
    color: colors.textMuted, fontSize: 12, fontWeight: '500',
    marginHorizontal: SPACING.xs,
  },
  serverConfig: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: colors.glassBorder,
  },
  saveUrlBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm, paddingVertical: SPACING.sm,
  },
  saveUrlText: {
    color: colors.accent, fontSize: 14, fontWeight: '600',
    marginLeft: SPACING.xs,
  },
});

export default LoginScreen;
