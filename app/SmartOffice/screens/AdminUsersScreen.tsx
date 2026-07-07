import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { INITIAL_CABINS } from '../constants/cabinData';
import { listUsers, assignUserRooms } from '../api/devices';

interface BackendUser {
  username: string;
  role: string;
  rooms: string[];
}

// r1 <-> cabin-1
const roomToCabinId = (room: string) => `cabin-${room.replace('r', '')}`;
const cabinIdToRoom = (cabinId: string) => `r${cabinId.replace('cabin-', '')}`;

interface AssignModalProps {
  user: BackendUser;
  onClose: () => void;
  onSave: (cabinIds: string[]) => Promise<void>;
}

const AssignModal: React.FC<AssignModalProps> = ({ user, onClose, onSave }) => {
  const { colors } = useTheme();
  const modal = useMemo(() => createModalStyles(colors), [colors]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user.rooms.map(roomToCabinId))
  );
  const [saving, setSaving] = useState(false);

  const toggle = (cabinId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cabinId)) next.delete(cabinId);
      else next.add(cabinId);
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    await onSave(Array.from(selected));
  };

  const noneSelected = selected.size === 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          {/* Header */}
          <View style={modal.header}>
            <View>
              <Text style={modal.title}>Assign Cabins</Text>
              <Text style={modal.subtitle}>{user.username} · {selected.size} selected</Text>
            </View>
            <TouchableOpacity style={modal.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={modal.list}
            contentContainerStyle={{ paddingVertical: SPACING.sm }}
          >
            {INITIAL_CABINS.map((cabin) => {
              const isActive = selected.has(cabin.id);
              return (
                <TouchableOpacity
                  key={cabin.id}
                  style={[modal.cabinRow, isActive && modal.cabinRowActive]}
                  onPress={() => toggle(cabin.id)}
                  activeOpacity={0.7}
                >
                  <View style={[modal.cabinIcon, isActive && modal.cabinIconActive]}>
                    <Ionicons
                      name="grid-outline"
                      size={16}
                      color={isActive ? colors.accent : colors.textMuted}
                    />
                  </View>
                  <View style={modal.cabinInfo}>
                    <Text style={[modal.cabinName, isActive && modal.cabinNameActive]}>
                      {cabin.name}
                    </Text>
                    <Text style={modal.cabinSub}>Light · Fan</Text>
                  </View>
                  <Ionicons
                    name={isActive ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isActive ? colors.accent : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer actions */}
          <View style={modal.footer}>
            <TouchableOpacity
              style={modal.clearBtn}
              onPress={() => setSelected(new Set())}
              disabled={noneSelected}
              activeOpacity={0.7}
            >
              <Text style={[modal.clearBtnText, noneSelected && { opacity: 0.4 }]}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={modal.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface AdminUsersScreenProps {
  refreshKey?: number;
}

const AdminUsersScreen: React.FC<AdminUsersScreenProps> = ({ refreshKey }) => {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<BackendUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (_) {}
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers, refreshKey]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const handleSave = async (cabinIds: string[]) => {
    if (!selectedUser) return;
    const rooms = cabinIds
      .map(cabinIdToRoom)
      .sort((a, b) => Number(a.replace('r', '')) - Number(b.replace('r', '')));
    try {
      await assignUserRooms(selectedUser.username, rooms);
      setUsers((prev) =>
        prev.map((u) => u.username === selectedUser.username ? { ...u, rooms } : u)
      );
    } catch (_) {}
    setSelectedUser(null);
  };

  const getCabinNames = (rooms: string[]): string[] =>
    rooms
      .map((r) => INITIAL_CABINS.find((c) => c.id === roomToCabinId(r))?.name ?? r)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const getInitials = (name: string) =>
    name.slice(0, 2).toUpperCase();

  const renderUser = ({ item }: { item: BackendUser }) => {
    const cabinNames = getCabinNames(item.rooms);
    return (
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.username}</Text>
          <Text style={styles.userEmail} numberOfLines={1}>{item.role}</Text>
          {cabinNames.length > 0 ? (
            <View style={styles.chipsWrap}>
              {cabinNames.map((name) => (
                <View key={name} style={styles.cabinChip}>
                  <Ionicons name="grid" size={10} color={colors.accent} />
                  <Text style={styles.cabinChipText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.unassignedChip}>
              <Ionicons name="alert-circle-outline" size={10} color={colors.textMuted} />
              <Text style={styles.unassignedText}>No cabin assigned</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.assignBtn}
          onPress={() => setSelectedUser(item)}
          activeOpacity={0.8}
        >
          <Ionicons name="swap-horizontal-outline" size={16} color={colors.accent} />
          <Text style={styles.assignBtnText}>Assign</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Glow */}
      <View style={styles.glowTop} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.subtitle}>{users.length} registered user{users.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{users.length}</Text>
          </View>
        </View>

        {users.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No users yet</Text>
            <Text style={styles.emptySubtitle}>
              Users will appear here after they sign up.
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(u) => u.username}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
            }
          />
        )}
      </SafeAreaView>

      {selectedUser && (
        <AssignModal
          key={selectedUser.username}
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={handleSave}
        />
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  glowTop: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.07)',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  countBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(47,128,237,0.15)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  userEmail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginTop: 5, gap: 4,
  },
  cabinChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  cabinChipText: { color: colors.accent, fontSize: 11, fontWeight: '600', marginLeft: 4 },
  unassignedChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginTop: 5,
  },
  unassignedText: { color: colors.textMuted, fontSize: 11, marginLeft: 4 },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 7,
    backgroundColor: 'rgba(47,128,237,0.08)',
    marginLeft: SPACING.sm,
  },
  assignBtnText: { color: colors.accent, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxxl },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: SPACING.sm },
  emptySubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

const createModalStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.glassBorder,
    paddingBottom: 40, maxHeight: '75%',
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
  list: { paddingHorizontal: SPACING.xl },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: colors.glassBorder,
  },
  clearBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm },
  clearBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: colors.accent,
    borderRadius: RADIUS.md, height: 48,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cabinRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, marginHorizontal: SPACING.sm, marginVertical: 2,
  },
  cabinRowActive: { backgroundColor: 'rgba(47,128,237,0.08)' },
  cabinIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
  },
  cabinIconActive: {
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderColor: 'rgba(47,128,237,0.3)',
  },
  cabinInfo: { flex: 1 },
  cabinName: { color: colors.textSecondary, fontSize: 15, fontWeight: '500' },
  cabinNameActive: { color: colors.text, fontWeight: '600' },
  cabinSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});

export default AdminUsersScreen;
