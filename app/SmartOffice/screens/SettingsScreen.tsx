import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { listUsers, createUser, deleteUser } from '../api/devices';
import { getBiometricCapability, isEnrolledLocally } from '../api/biometric';
import ChangePasswordModal from '../components/ChangePasswordModal';

interface BackendUser {
  username: string;
  role: string;
  rooms: string[];
}

// ─── Appearance ────────────────────────────────────────────────────────────────

const THEME_OPTIONS: { key: 'light' | 'dark' | 'system'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

const AppearanceCard: React.FC = () => {
  const { colors, preference, setPreference } = useTheme();
  const ap = useMemo(() => createApStyles(colors), [colors]);

  return (
    <View style={ap.card}>
      <View style={ap.cardHeader}>
        <View style={ap.cardIconWrap}>
          <Ionicons name="contrast-outline" size={18} color={colors.accent} />
        </View>
        <View>
          <Text style={ap.cardTitle}>Appearance</Text>
          <Text style={ap.cardSub}>Choose how Nestboard looks</Text>
        </View>
      </View>

      <View style={ap.optionsRow}>
        {THEME_OPTIONS.map((opt) => {
          const active = preference === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[ap.option, active && ap.optionActive]}
              onPress={() => setPreference(opt.key)}
              activeOpacity={0.8}
            >
              <Ionicons name={opt.icon} size={18} color={active ? colors.accent : colors.textMuted} />
              <Text style={[ap.optionText, active && ap.optionTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const createApStyles = (colors: ThemeColors) => StyleSheet.create({
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
  optionsRow: { flexDirection: 'row', gap: SPACING.sm },
  option: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceLight,
  },
  optionActive: { borderColor: 'rgba(47,128,237,0.4)', backgroundColor: 'rgba(47,128,237,0.1)' },
  optionText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: colors.accent },
});

// ─── Biometric Login ────────────────────────────────────────────────────────────

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

// ─── Create User Form ─────────────────────────────────────────────────────────

interface CreateFormProps {
  onCreated: (user: BackendUser) => void;
}

const CreateUserForm: React.FC<CreateFormProps> = ({ onCreated }) => {
  const { colors } = useTheme();
  const cf = useMemo(() => createCfStyles(colors), [colors]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async () => {
    const u = username.trim();
    if (u.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (password.length < 4) { setError('Password must be at least 4 characters.'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const user = await createUser(u, password);
      setSuccess(`Account "${user.username}" created successfully.`);
      setUsername(''); setPassword('');
      onCreated(user);
    } catch (e: any) {
      try {
        const json = await e.json();
        setError(json.detail ?? 'Failed to create user.');
      } catch (_) {
        setError('Failed to create user.');
      }
    }
    setLoading(false);
  };

  return (
    <View style={cf.card}>
      <View style={cf.cardHeader}>
        <View style={cf.cardIconWrap}>
          <Ionicons name="person-add-outline" size={18} color={colors.accent} />
        </View>
        <View>
          <Text style={cf.cardTitle}>Create User</Text>
          <Text style={cf.cardSub}>Add a new account to the system</Text>
        </View>
      </View>

      {/* Username */}
      <View style={cf.fieldGroup}>
        <Text style={cf.fieldLabel}>USERNAME</Text>
        <View style={[cf.inputWrap, !!error && cf.inputError]}>
          <Ionicons name="at-outline" size={16} color={colors.textMuted} style={cf.inputIcon} />
          <TextInput
            style={cf.input}
            placeholder="e.g. john_doe"
            placeholderTextColor={colors.textMuted}
            value={username}
            onChangeText={(t) => { setUsername(t); setError(''); setSuccess(''); }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>
      </View>

      {/* Password */}
      <View style={cf.fieldGroup}>
        <Text style={cf.fieldLabel}>PASSWORD</Text>
        <View style={[cf.inputWrap, !!error && cf.inputError]}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} style={cf.inputIcon} />
          <TextInput
            style={cf.input}
            placeholder="Min. 4 characters"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(''); setSuccess(''); }}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={cf.eyeBtn}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error / success feedback */}
      {!!error && (
        <View style={cf.feedbackRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#FF4D4D" />
          <Text style={cf.errorText}>{error}</Text>
        </View>
      )}
      {!!success && (
        <View style={[cf.feedbackRow, cf.successRow]}>
          <Ionicons name="checkmark-circle-outline" size={13} color={colors.success} />
          <Text style={cf.successText}>{success}</Text>
        </View>
      )}

      {/* Create button */}
      <TouchableOpacity
        style={[cf.createBtn, loading && cf.createBtnDisabled]}
        onPress={handleCreate}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name="add-circle-outline" size={18} color="#fff" />
              <Text style={cf.createBtnText}>Create Account</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
};

const createCfStyles = (colors: ThemeColors) => StyleSheet.create({
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
  successRow: {},
  errorText:   { color: '#FF4D4D', fontSize: 12 },
  successText: { color: colors.success, fontSize: 12 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: colors.accent, borderRadius: RADIUS.md, height: 48, marginTop: SPACING.xs,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ─── User List ─────────────────────────────────────────────────────────────────

interface UserListProps {
  users: BackendUser[];
  onDelete: (username: string) => void;
  onResetPassword: (username: string) => void;
  deleting: string | null;
}

const UserList: React.FC<UserListProps> = ({ users, onDelete, onResetPassword, deleting }) => {
  const { colors } = useTheme();
  const ul = useMemo(() => createUlStyles(colors), [colors]);

  return (
  <View style={ul.card}>
    <View style={ul.cardHeader}>
      <View style={ul.cardIconWrap}>
        <Ionicons name="people-outline" size={18} color={colors.blue} />
      </View>
      <View>
        <Text style={ul.cardTitle}>Manage Users</Text>
        <Text style={ul.cardSub}>{users.length} registered account{users.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>

    {users.length === 0 ? (
      <View style={ul.empty}>
        <Ionicons name="person-outline" size={28} color={colors.textMuted} />
        <Text style={ul.emptyText}>No users yet</Text>
      </View>
    ) : (
      users.map((u, idx) => (
        <View key={u.username} style={[ul.row, idx < users.length - 1 && ul.rowBorder]}>
          <View style={ul.avatar}>
            <Text style={ul.avatarText}>{u.username.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={ul.info}>
            <Text style={ul.username}>{u.username}</Text>
            <Text style={ul.meta}>
              {u.role} {u.rooms.length > 0 ? `· ${u.rooms.join(', ')}` : '· No room'}
            </Text>
          </View>
          <TouchableOpacity
            style={ul.resetBtn}
            onPress={() => onResetPassword(u.username)}
            activeOpacity={0.7}
          >
            <Ionicons name="key-outline" size={15} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={ul.deleteBtn}
            onPress={() => onDelete(u.username)}
            disabled={deleting === u.username}
            activeOpacity={0.7}
          >
            {deleting === u.username
              ? <ActivityIndicator size="small" color="#FF4D4D" />
              : <Ionicons name="trash-outline" size={15} color="#FF4D4D" />
            }
          </TouchableOpacity>
        </View>
      ))
    )}
  </View>
  );
};

const createUlStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, gap: SPACING.md },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSub:   { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(47,128,237,0.12)', borderWidth: 1, borderColor: 'rgba(47,128,237,0.25)',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  avatarText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  info: { flex: 1 },
  username: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  resetBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(47,128,237,0.08)', borderWidth: 1, borderColor: 'rgba(47,128,237,0.22)',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  deleteBtn: {
    width: 34, height: 34, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,77,77,0.08)', borderWidth: 1, borderColor: 'rgba(255,77,77,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

interface SettingsScreenProps {
  isActive?: boolean;
  onUserChanged?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ isActive, onUserChanged }) => {
  const { colors, theme } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [resetUser, setResetUser] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (_) {}
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  // Clear the create-user form's success/error state when leaving this tab
  useEffect(() => {
    if (!isActive) setFormKey((k) => k + 1);
  }, [isActive]);

  const handleCreated = (newUser: BackendUser) => {
    setUsers((prev) => [...prev, newUser]);
    onUserChanged?.();
  };

  const handleDelete = (username: string) => {
    Alert.alert(
      'Delete User',
      `Remove account "${username}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeleting(username);
            try {
              await deleteUser(username);
              setUsers((prev) => prev.filter((u) => u.username !== username));
              onUserChanged?.();
            } catch (_) {
              Alert.alert('Error', 'Could not delete user.');
            }
            setDeleting(null);
          },
        },
      ]
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={s.glowTR} />

      <SafeAreaView style={s.safe} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Settings</Text>
          <Text style={s.subtitle}>Admin controls</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollBody}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
        >
          {/* Appearance section */}
          <AppearanceCard />

          {/* Biometric login section */}
          <BiometricCard />

          {/* Create user section — key resets form state when user navigates away */}
          <CreateUserForm key={formKey} onCreated={handleCreated} />

          {/* User list section */}
          {loadingUsers ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.loadingText}>Loading users…</Text>
            </View>
          ) : (
            <UserList
              users={users}
              onDelete={handleDelete}
              onResetPassword={setResetUser}
              deleting={deleting}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      <ChangePasswordModal
        visible={!!resetUser}
        username={resetUser ?? ''}
        onClose={() => setResetUser(null)}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  glowTR: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.07)',
  },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  title:    { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  scrollBody: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg },
  loadingText: { color: colors.textMuted, fontSize: 13 },
});

export default SettingsScreen;
