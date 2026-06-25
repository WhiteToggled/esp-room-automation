import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import * as api from '../api/devices';
import { StateLogEntry } from '../api/devices';
import LogsChart from '../components/LogsChart';
import FadeInView from '../components/FadeInView';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDeviceLabel = (id: string) => {
  const [room, dev] = id.split('/');
  const roomNum = room?.replace('r', '') ?? '?';
  const isLight = dev?.startsWith('l');
  const devNum = dev?.replace(/[lf]/, '');
  const suffix = devNum && devNum !== '1' ? ` ${devNum}` : '';
  return `R${roomNum} ${isLight ? 'Light' : 'Fan'}${suffix}`;
};

const formatLogTime = (iso: string) => {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  const absolute = date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  let relative: string;
  if (mins < 1) relative = 'Just now';
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 1440) relative = `${Math.round(mins / 60)}h ago`;
  else relative = `${Math.round(mins / 1440)}d ago`;
  return { absolute, relative };
};

// ─── Log Entry Card ───────────────────────────────────────────────────────────

interface LogEntryCardProps {
  entry: StateLogEntry;
  isLatest: boolean;
  index: number;
}

const LogEntryCard: React.FC<LogEntryCardProps> = ({ entry, isLatest, index }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const deviceIds = Object.keys(entry.snapshot).sort();
  const onCount = deviceIds.reduce((acc, id) => acc + (entry.snapshot[id] ? 1 : 0), 0);
  const { absolute, relative } = formatLogTime(entry.logged_at);

  return (
    <FadeInView delay={Math.min(index, 8) * 50} distance={12}>
    <TouchableOpacity
      style={[styles.card, isLatest && styles.cardLatest]}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.timeGroup}>
          <View style={[styles.clockIcon, isLatest && styles.clockIconLatest]}>
            <Ionicons name="time-outline" size={14} color={isLatest ? colors.accent : colors.textMuted} />
          </View>
          <View>
            <Text style={styles.absoluteTime}>{absolute}</Text>
            <Text style={styles.relativeTime}>{relative}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {isLatest && (
            <View style={styles.latestBadge}>
              <Text style={styles.latestBadgeText}>LATEST</Text>
            </View>
          )}
          <View style={[styles.countBadge, onCount > 0 && styles.countBadgeOn]}>
            <Ionicons name="power" size={10} color={onCount > 0 ? colors.accent : colors.textMuted} />
            <Text style={[styles.countText, onCount > 0 && styles.countTextOn]}>
              {onCount}/{deviceIds.length}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.chipGrid}>
          {deviceIds.map((id) => {
            const isOn = Boolean(entry.snapshot[id]);
            return (
              <View key={id} style={[styles.chip, isOn && styles.chipOn]}>
                <View style={[styles.chipDot, isOn && styles.chipDotOn]} />
                <Text style={[styles.chipText, isOn && styles.chipTextOn]}>
                  {formatDeviceLabel(id)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
    </FadeInView>
  );
};

const MemoLogEntryCard = memo(LogEntryCard);

// ─── Main Screen ───────────────────────────────────────────────────────────────

interface LogsScreenProps {
  isActive?: boolean;
}

const LogsScreen: React.FC<LogsScreenProps> = ({ isActive }) => {
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [logs, setLogs] = useState<StateLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.getLogs(100);
      setLogs(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  useEffect(() => {
    if (isActive) fetchLogs();
  }, [isActive, fetchLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  const handleCapture = useCallback(async () => {
    setCapturing(true);
    try {
      await api.triggerLog();
      await fetchLogs();
    } catch (_) {}
    setCapturing(false);
  }, [fetchLogs]);

  const renderItem = useCallback(
    ({ item, index }: { item: StateLogEntry; index: number }) => (
      <MemoLogEntryCard entry={item} isLatest={index === 0} index={index} />
    ),
    []
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.glowTR} />
      <View style={styles.glowBL} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Activity Logs</Text>
            <Text style={styles.subtitle}>
              {loading ? 'Loading…' : `${logs.length} snapshot${logs.length !== 1 ? 's' : ''} recorded`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={capturing}
            activeOpacity={0.85}
          >
            {capturing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="camera-outline" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Loading logs…</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptySubtitle}>
              State snapshots are captured automatically.{'\n'}Tap the camera icon to capture one now.
            </Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
            }
            ListHeaderComponent={<LogsChart isActive={isActive} />}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  glowTR: { position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,122,0,0.07)' },
  glowBL: { position: 'absolute', bottom: 100, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,122,0,0.04)' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.lg,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  captureBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  captureBtnDisabled: { opacity: 0.6 },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xxxl },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: SPACING.sm },
  emptySubtitle: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Log entry card
  card: {
    backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  cardLatest: { borderColor: 'rgba(255,122,0,0.3)', backgroundColor: 'rgba(255,122,0,0.06)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  clockIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  clockIconLatest: { backgroundColor: 'rgba(255,122,0,0.15)' },
  absoluteTime: { color: colors.text, fontSize: 14, fontWeight: '600' },
  relativeTime: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  latestBadge: {
    backgroundColor: 'rgba(255,122,0,0.15)', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  latestBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  countBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  countBadgeOn: { backgroundColor: 'rgba(255,122,0,0.12)' },
  countText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  countTextOn: { color: colors.accent },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs,
    marginTop: SPACING.lg, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.glassBorder,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 5,
  },
  chipOn: { backgroundColor: 'rgba(255,122,0,0.1)', borderColor: 'rgba(255,122,0,0.3)' },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  chipDotOn: { backgroundColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
});

export default LogsScreen;
