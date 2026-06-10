import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { listUsers, createUser, deleteUser } from '../api/devices';

interface BackendUser {
  username: string;
  role: string;
  rooms: string[];
}

// ─── Create User Form ─────────────────────────────────────────────────────────

interface CreateFormProps {
  onCreated: (user: BackendUser) => void;
}

const CreateUserForm: React.FC<CreateFormProps> = ({ onCreated }) => {
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
          <Ionicons name="person-add-outline" size={18} color={COLORS.accent} />
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
          <Ionicons name="at-outline" size={16} color={COLORS.textMuted} style={cf.inputIcon} />
          <TextInput
            style={cf.input}
            placeholder="e.g. john_doe"
            placeholderTextColor={COLORS.textMuted}
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
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} style={cf.inputIcon} />
          <TextInput
            style={cf.input}
            placeholder="Min. 4 characters"
            placeholderTextColor={COLORS.textMuted}
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
              color={COLORS.textMuted}
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
          <Ionicons name="checkmark-circle-outline" size={13} color={COLORS.success} />
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

const cf = StyleSheet.create({
  card: {
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.xl,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, gap: SPACING.md },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,122,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,122,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  cardSub:   { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  fieldGroup: { marginBottom: SPACING.md },
  fieldLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: SPACING.xs },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, height: 48,
  },
  inputError: { borderColor: 'rgba(255,77,77,0.5)' },
  inputIcon: { marginRight: SPACING.xs },
  input: { flex: 1, color: COLORS.text, fontSize: 14 },
  eyeBtn: { padding: SPACING.xs },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  successRow: {},
  errorText:   { color: '#FF4D4D', fontSize: 12 },
  successText: { color: COLORS.success, fontSize: 12 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.accent, borderRadius: RADIUS.md, height: 48, marginTop: SPACING.xs,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ─── User List ─────────────────────────────────────────────────────────────────

interface UserListProps {
  users: BackendUser[];
  onDelete: (username: string) => void;
  deleting: string | null;
}

const UserList: React.FC<UserListProps> = ({ users, onDelete, deleting }) => (
  <View style={ul.card}>
    <View style={ul.cardHeader}>
      <View style={ul.cardIconWrap}>
        <Ionicons name="people-outline" size={18} color={COLORS.blue} />
      </View>
      <View>
        <Text style={ul.cardTitle}>Manage Users</Text>
        <Text style={ul.cardSub}>{users.length} registered account{users.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>

    {users.length === 0 ? (
      <View style={ul.empty}>
        <Ionicons name="person-outline" size={28} color={COLORS.textMuted} />
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

const ul = StyleSheet.create({
  card: {
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, gap: SPACING.md },
  cardIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(96,165,250,0.12)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  cardSub:   { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: SPACING.xl, gap: SPACING.sm },
  emptyText: { color: COLORS.textMuted, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,122,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,122,0,0.25)',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  avatarText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  info: { flex: 1 },
  username: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  meta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
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
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (_) {}
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
        >
          {/* Create user section — key resets form state when user navigates away */}
          <CreateUserForm key={formKey} onCreated={handleCreated} />

          {/* User list section */}
          {loadingUsers ? (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={s.loadingText}>Loading users…</Text>
            </View>
          ) : (
            <UserList users={users} onDelete={handleDelete} deleting={deleting} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  safe: { flex: 1 },
  glowTR: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,122,0,0.07)',
  },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  title:    { color: COLORS.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  scrollBody: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.lg },
  loadingText: { color: COLORS.textMuted, fontSize: 13 },
});

export default SettingsScreen;
