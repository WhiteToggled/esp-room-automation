import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getLogs } from '../api/devices';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - SPACING.lg * 2 - SPACING.xxl * 2;
const CHART_HEIGHT = 110;
const BAR_MIN_H = 3;

interface LogEntry {
  id: number;
  logged_at: string;
  snapshot: Record<string, number>;
}

interface DeviceStat {
  id: string;
  onCount: number;
  totalCount: number;
  uptimePct: number;
  lastSeen: string | null;
}

function parseDate(s: string) {
  return new Date(s.endsWith('Z') ? s : s + 'Z');
}

function friendlyId(id: string) {
  const [room, device] = id.split('/');
  const roomLabel = room ? `Room ${room.replace(/\D/g, '')}` : id;
  let devLabel = device ?? '';
  if (devLabel.startsWith('l')) devLabel = `Light ${devLabel.replace(/\D/g, '')}`;
  else if (devLabel.startsWith('f')) devLabel = `Fan ${devLabel.replace(/\D/g, '')}`;
  else if (devLabel.startsWith('a')) devLabel = `AC ${devLabel.replace(/\D/g, '')}`;
  return { roomLabel, devLabel };
}

function timeAgo(iso: string) {
  const diff = (Date.now() - parseDate(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function computeStats(logs: LogEntry[]): DeviceStat[] {
  const counts: Record<string, { on: number; total: number; lastSeen: string | null }> = {};
  for (const log of logs) {
    for (const [id, state] of Object.entries(log.snapshot)) {
      if (!counts[id]) counts[id] = { on: 0, total: 0, lastSeen: null };
      counts[id].total++;
      if (state) {
        counts[id].on++;
        if (!counts[id].lastSeen || log.logged_at > counts[id].lastSeen!)
          counts[id].lastSeen = log.logged_at;
      }
    }
  }
  return Object.entries(counts)
    .map(([id, c]) => ({
      id,
      onCount: c.on,
      totalCount: c.total,
      uptimePct: c.total ? Math.round((c.on / c.total) * 100) : 0,
      lastSeen: c.lastSeen,
    }))
    .sort((a, b) => b.uptimePct - a.uptimePct);
}

function activeDevicesOverTime(logs: LogEntry[]): { label: string; value: number }[] {
  return [...logs]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .slice(-24)
    .map((log) => ({
      label: parseDate(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: Object.values(log.snapshot).filter(Boolean).length,
    }));
}

// ── Sparkline bar chart ──────────────────────────────────────────────────────

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(4, (CHART_WIDTH / data.length) - 3);

  return (
    <View style={{ height: CHART_HEIGHT + 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 3 }}>
        {data.map((d, i) => {
          const h = Math.max(BAR_MIN_H, (d.value / max) * CHART_HEIGHT);
          const opacity = 0.45 + 0.55 * (d.value / max);
          return (
            <View
              key={i}
              style={{
                width: barW,
                height: h,
                borderRadius: 3,
                backgroundColor: COLORS.accent,
                opacity,
              }}
            />
          );
        })}
      </View>
      {/* x-axis: first, middle, last labels */}
      {data.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={styles.axisLabel}>{data[0].label}</Text>
          <Text style={styles.axisLabel}>{data[Math.floor(data.length / 2)].label}</Text>
          <Text style={styles.axisLabel}>{data[data.length - 1].label}</Text>
        </View>
      )}
    </View>
  );
}

// ── Uptime arc ───────────────────────────────────────────────────────────────

function UptimeBadge({ pct }: { pct: number }) {
  const color =
    pct >= 70 ? COLORS.success : pct >= 40 ? COLORS.accent : COLORS.textSecondary;
  return (
    <View style={[styles.uptimeBadge, { borderColor: color }]}>
      <Text style={[styles.uptimeText, { color }]}>{pct}%</Text>
    </View>
  );
}

// ── Summary cards ────────────────────────────────────────────────────────────

function SummaryRow({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) return null;
  const latest = logs.reduce((a, b) => (a.logged_at > b.logged_at ? a : b));
  const activeNow = Object.values(latest.snapshot).filter(Boolean).length;
  const totalDevices = Object.keys(latest.snapshot).length;
  const allStats = computeStats(logs);
  const mostUsed = allStats[0];

  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{activeNow}</Text>
        <Text style={styles.summaryLabel}>Active now</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryValue}>{totalDevices}</Text>
        <Text style={styles.summaryLabel}>Total devices</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={[styles.summaryValue, { fontSize: 13 }]}>
          {mostUsed ? friendlyId(mostUsed.id).devLabel || mostUsed.id : '—'}
        </Text>
        <Text style={styles.summaryLabel}>Most active</Text>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data: LogEntry[] = await getLogs();
      setLogs(data);
    } catch {
      setError('Failed to load logs. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    pollRef.current = setInterval(() => fetchLogs(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLogs]);

  const onRefresh = () => { setRefreshing(true); fetchLogs(); };

  const chartData = activeDevicesOverTime(logs);
  const stats = computeStats(logs);

  // Group stats by room
  const byRoom: Record<string, DeviceStat[]> = {};
  for (const s of stats) {
    const room = s.id.split('/')[0] ?? 'unknown';
    (byRoom[room] = byRoom[room] ?? []).push(s);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={() => fetchLogs()} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchLogs()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <SummaryRow logs={logs} />

          {/* Active devices over time */}
          {chartData.length > 1 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Active devices over time</Text>
              <Text style={styles.cardSubtitle}>Last {chartData.length} snapshots</Text>
              <View style={{ marginTop: SPACING.md }}>
                <BarChart data={chartData} />
              </View>
            </View>
          )}

          {/* Per-room device stats */}
          {Object.entries(byRoom).map(([room, devices]) => (
            <View key={room} style={styles.card}>
              <Text style={styles.cardTitle}>
                Room {room.replace(/\D/g, '') || room}
              </Text>
              {devices.map((stat) => {
                const { devLabel } = friendlyId(stat.id);
                return (
                  <View key={stat.id} style={styles.deviceRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deviceName}>{devLabel || stat.id}</Text>
                      {stat.lastSeen && (
                        <Text style={styles.deviceSub}>last on {timeAgo(stat.lastSeen)}</Text>
                      )}
                      {/* Uptime bar */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${stat.uptimePct}%`,
                              backgroundColor:
                                stat.uptimePct >= 70
                                  ? COLORS.success
                                  : stat.uptimePct >= 40
                                  ? COLORS.accent
                                  : COLORS.textMuted,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <UptimeBadge pct={stat.uptimePct} />
                  </View>
                );
              })}
            </View>
          ))}

          {logs.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No log snapshots yet.</Text>
              <Text style={styles.emptySubText}>Snapshots are taken automatically by the scheduler.</Text>
            </View>
          )}

          <Text style={styles.footer}>
            {logs.length} snapshot{logs.length !== 1 ? 's' : ''} loaded · auto-refreshes every 30s
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: FONTS.bold,
    letterSpacing: -0.3,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  refreshBtnText: {
    color: COLORS.accent,
    fontSize: 18,
  },
  scroll: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxxl,
    gap: SPACING.md,
  },
  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  summaryValue: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: FONTS.bold,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: FONTS.semibold,
  },
  cardSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  // Device row
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
    marginTop: SPACING.sm,
  },
  deviceName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: FONTS.medium,
  },
  deviceSub: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  barTrack: {
    height: 5,
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  uptimeBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uptimeText: {
    fontSize: 12,
    fontWeight: FONTS.bold,
  },
  // Chart
  axisLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  // Misc
  errorText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
  },
  retryBtnText: {
    color: COLORS.text,
    fontWeight: FONTS.semibold,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  emptySubText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
