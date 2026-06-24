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
import { getLogs, triggerLog } from '../api/devices';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const H_PAD = SPACING.lg;
const Y_LABEL_W = 56;
const CHART_W = SCREEN_WIDTH - H_PAD * 2 - Y_LABEL_W - SPACING.xl * 2;
const ROW_H = 28;
const ROW_GAP = 6;

type Range = '6h' | '12h' | '1d' | '7d' | '30d';
const RANGE_LABELS: Record<Range, string> = {
  '6h': '6h', '12h': '12h', '1d': '1d', '7d': '7d', '30d': '30d',
};
const RANGE_MS: Record<Range, number> = {
  '6h':       6 * 3600 * 1000,
  '12h':     12 * 3600 * 1000,
  '1d':      24 * 3600 * 1000,
  '7d':   7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

interface LogEntry {
  id: number;
  logged_at: string;
  snapshot: Record<string, number>;
}

interface Interval {
  deviceId: string;
  startMs: number;
  endMs: number;
}

interface DeviceStat {
  id: string;
  uptimePct: number;
  lastSeen: string | null;
}

function parseMs(s: string) {
  return new Date(s.endsWith('Z') ? s : s + 'Z').getTime();
}

function friendlyLabel(id: string) {
  const [room, dev] = id.split('/');
  const r = room?.replace(/\D/g, '') ?? '';
  let d = dev ?? '';
  if (d.startsWith('l')) d = `L${d.replace(/\D/g, '')}`;
  else if (d.startsWith('f')) d = `F${d.replace(/\D/g, '')}`;
  else if (d.startsWith('a')) d = `A${d.replace(/\D/g, '')}`;
  return `r${r}/${d}`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - parseMs(iso)) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function computeStats(logs: LogEntry[]): DeviceStat[] {
  const map: Record<string, { on: number; total: number; lastSeen: string | null }> = {};
  for (const log of logs) {
    for (const [id, state] of Object.entries(log.snapshot)) {
      if (!map[id]) map[id] = { on: 0, total: 0, lastSeen: null };
      map[id].total++;
      if (state) {
        map[id].on++;
        if (!map[id].lastSeen || log.logged_at > map[id].lastSeen!)
          map[id].lastSeen = log.logged_at;
      }
    }
  }
  return Object.entries(map)
    .map(([id, c]) => ({
      id,
      uptimePct: c.total ? Math.round((c.on / c.total) * 100) : 0,
      lastSeen: c.lastSeen,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function groupByRoom<T extends { id: string }>(items: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const room = item.id.split('/')[0] ?? 'unknown';
    (groups[room] = groups[room] ?? []).push(item);
  }
  return groups;
}

function roomLabel(room: string) {
  const n = room.replace(/\D/g, '');
  return n ? `Room ${n}` : room;
}

function buildIntervals(logs: LogEntry[], rangeStart: number, rangeEnd: number): Interval[] {
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  if (sorted.length < 2) return [];

  const deviceIds = new Set<string>();
  for (const l of sorted) Object.keys(l.snapshot).forEach((id) => deviceIds.add(id));

  const intervals: Interval[] = [];

  for (const deviceId of deviceIds) {
    let onStart: number | null = null;
    for (let i = 0; i < sorted.length; i++) {
      const ms = parseMs(sorted[i].logged_at);
      const state = sorted[i].snapshot[deviceId] ?? 0;
      if (state && onStart === null) { onStart = ms; }
      if (!state && onStart !== null) {
        const prevMs = i > 0 ? parseMs(sorted[i - 1].logged_at) : ms;
        intervals.push({ deviceId, startMs: onStart, endMs: prevMs });
        onStart = null;
      }
      if (i === sorted.length - 1 && onStart !== null) {
        intervals.push({ deviceId, startMs: onStart, endMs: Math.min(rangeEnd, Date.now()) });
      }
    }
  }

  return intervals
    .map((iv) => ({ ...iv, startMs: Math.max(iv.startMs, rangeStart), endMs: Math.min(iv.endMs, rangeEnd) }))
    .filter((iv) => iv.endMs > iv.startMs);
}

function formatAxisLabel(ms: number, range: Range): string {
  const d = new Date(ms);
  if (range === '6h' || range === '12h')
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (range === '1d')
    return d.toLocaleTimeString([], { hour: '2-digit' });
  if (range === '7d')
    return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const GRID_LINES = 5;

// ── Gantt chart ───────────────────────────────────────────────────────────────

interface GanttProps {
  intervals: Interval[];
  devices: string[];
  rangeStart: number;
  rangeEnd: number;
  range: Range;
}

function GanttChart({ intervals, devices, rangeStart, rangeEnd, range }: GanttProps) {
  const span = rangeEnd - rangeStart;

  if (!devices.length) {
    return (
      <Text style={tx.emptySubText}>No devices selected. Tap tiles below to add them.</Text>
    );
  }

  const toX = (ms: number) => Math.max(0, Math.min(CHART_W, ((ms - rangeStart) / span) * CHART_W));
  const gridMs = Array.from({ length: GRID_LINES + 1 }, (_, i) => rangeStart + (span * i) / GRID_LINES);
  const chartH = devices.length * (ROW_H + ROW_GAP) - ROW_GAP;

  return (
    <View style={{ marginTop: SPACING.md }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: Y_LABEL_W }}>
          {devices.map((id, idx) => {
            const thisRoom = id.split('/')[0];
            const prevRoom = idx > 0 ? devices[idx - 1].split('/')[0] : thisRoom;
            const isNewRoom = idx > 0 && thisRoom !== prevRoom;
            return (
              <View key={id}>
                {isNewRoom && <View style={{ height: 9 }} />}
                <View style={{ height: ROW_H, marginBottom: ROW_GAP, justifyContent: 'center' }}>
                  <Text style={tx.ganttLabel} numberOfLines={1}>{friendlyLabel(id)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Chart area */}
        <View style={{ width: CHART_W, overflow: 'hidden' }}>
          {/* Vertical grid lines */}
          {gridMs.map((ms, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: toX(ms),
                top: 0,
                width: 1,
                height: chartH,
                backgroundColor: i === 0 || i === GRID_LINES
                  ? COLORS.glassBorder
                  : 'rgba(255,255,255,0.07)',
              }}
            />
          ))}

          {/* Device rows — with room separator lines */}
          {devices.map((id, idx) => {
            const thisRoom = id.split('/')[0];
            const prevRoom = idx > 0 ? devices[idx - 1].split('/')[0] : thisRoom;
            const isNewRoom = idx > 0 && thisRoom !== prevRoom;
            const rowIntervals = intervals.filter((iv) => iv.deviceId === id);
            return (
              <View key={id}>
                {isNewRoom && (
                  <View style={{ height: 1, backgroundColor: COLORS.glassBorder, marginVertical: 4 }} />
                )}
                <View
                  style={{
                    height: ROW_H,
                    marginBottom: ROW_GAP,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                {rowIntervals.map((iv, i) => {
                  const x = toX(iv.startMs);
                  const w = Math.max(2, toX(iv.endMs) - x);
                  return (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: x,
                        width: w,
                        top: 4,
                        bottom: 4,
                        borderRadius: 3,
                        backgroundColor: COLORS.accent,
                        opacity: 0.9,
                      }}
                    />
                  );
                })}
              </View>
            </View>
            );
          })}
        </View>
      </View>

      {/* X-axis labels — rotated to avoid overlap */}
      <View style={{ height: 36, marginLeft: Y_LABEL_W }}>
        {gridMs.map((ms, i) => {
          const x = (i / GRID_LINES) * CHART_W;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: Math.min(Math.max(x - 18, 0), CHART_W - 36),
                top: 4,
                width: 36,
                alignItems: 'center',
                transform: [{ rotate: '-35deg' }],
              }}
            >
              <Text style={tx.axisLabel}>{formatAxisLabel(ms, range)}</Text>
            </View>
          );
        })}
      </View> 
    </View>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

interface StatTileProps {
  stat: DeviceStat;
  selected: boolean;
  onToggle: () => void;
}

function StatTile({ stat, selected, onToggle }: StatTileProps) {
  const color =
    stat.uptimePct >= 70 ? COLORS.success :
    stat.uptimePct >= 40 ? COLORS.accent :
    COLORS.textSecondary;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.75}
      style={[
        vx.statTile,
        selected && { borderColor: color, backgroundColor: 'rgba(255,255,255,0.05)' },
      ]}
    >
      <View style={vx.statTileBar}>
        <View style={[vx.statTileBarFill, { width: `${stat.uptimePct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[tx.statTileId, selected && { color: COLORS.text }]} numberOfLines={1}>
        {friendlyLabel(stat.id)}
      </Text>
      <Text style={[tx.statTilePct, { color }]}>{stat.uptimePct}%</Text>
      <Text style={tx.statTileSub}>
        {stat.lastSeen ? timeAgo(stat.lastSeen) : 'never on'}
      </Text>
    </TouchableOpacity>
  );
}

// ── Totals row ────────────────────────────────────────────────────────────────

function TotalsRow({ logs }: { logs: LogEntry[] }) {
  if (!logs.length) return null;
  const latest = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0];
  const activeNow = Object.values(latest.snapshot).filter(Boolean).length;
  const total = Object.keys(latest.snapshot).length;
  return (
    <View style={vx.totalsRow}>
      <View style={vx.totalsCard}>
        <Text style={tx.totalsValue}>{activeNow}</Text>
        <Text style={tx.totalsLabel}>Active now</Text>
      </View>
      <View style={vx.totalsCard}>
        <Text style={tx.totalsValue}>{total}</Text>
        <Text style={tx.totalsLabel}>Total devices</Text>
      </View>
      <View style={vx.totalsCard}>
        <Text style={tx.totalsValue}>{logs.length}</Text>
        <Text style={tx.totalsLabel}>Snapshots</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('6h');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data: LogEntry[] = await getLogs(500);
      setLogs(data);
      setSelectedDevices((prev) => {
        if (prev.size > 0) return prev;
        const ids = new Set<string>();
        for (const log of data) Object.keys(log.snapshot).forEach((id) => ids.add(id));
        return ids;
      });
    } catch {
      setError('Failed to load logs. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    triggerLog().catch(() => {});
    pollRef.current = setInterval(() => fetchLogs(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLogs]);

  const toggleDevice = useCallback((id: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const stats = computeStats(logs);
  const rangeEnd = Date.now();
  const rangeStart = rangeEnd - RANGE_MS[range];
  const visibleDevices = stats.filter((s) => selectedDevices.has(s.id)).map((s) => s.id);
  const intervals = buildIntervals(logs, rangeStart, rangeEnd);

  return (
    <View style={vx.container}>
      <View style={vx.header}>
        <Text style={tx.headerTitle}>Analytics</Text>
        <TouchableOpacity onPress={() => fetchLogs()} style={vx.refreshBtn}>
          <Text style={tx.refreshBtnText}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={vx.centered}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : error ? (
        <View style={vx.centered}>
          <Text style={tx.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchLogs()} style={vx.retryBtn}>
            <Text style={tx.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={vx.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchLogs(); }}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <TotalsRow logs={logs} />

          <View style={vx.card}>
            <View style={vx.chartHeader}>
              <Text style={tx.cardTitle}>Device timeline</Text>
              <View style={vx.rangeRow}>
                {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRange(r)}
                    style={[vx.rangeBtn, range === r && vx.rangeBtnActive]}
                  >
                    <Text style={[tx.rangeBtnText, range === r && tx.rangeBtnTextActive]}>
                      {RANGE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <GanttChart
              intervals={intervals}
              devices={visibleDevices}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              range={range}
            />
          </View>

          {stats.length > 0 && Object.entries(groupByRoom(stats)).map(([room, roomStats]) => (
            <View key={room} style={vx.card}>
              <View style={vx.roomHeader}>
                <View style={vx.roomDot} />
                <Text style={tx.cardTitle}>{roomLabel(room)}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const allSelected = roomStats.every((s) => selectedDevices.has(s.id));
                    setSelectedDevices((prev) => {
                      const next = new Set(prev);
                      roomStats.forEach((s) => allSelected ? next.delete(s.id) : next.add(s.id));
                      return next;
                    });
                  }}
                  style={vx.roomToggleBtn}
                >
                  <Text style={tx.roomToggleBtnText}>
                    {roomStats.every((s) => selectedDevices.has(s.id)) ? 'Hide all' : 'Show all'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={vx.tilesGrid}>
                {roomStats.map((s) => (
                  <StatTile
                    key={s.id}
                    stat={s}
                    selected={selectedDevices.has(s.id)}
                    onToggle={() => toggleDevice(s.id)}
                  />
                ))}
              </View>
            </View>
          ))}

          {logs.length === 0 && (
            <View style={vx.centered}>
              <Text style={tx.emptyText}>No snapshots yet.</Text>
              <Text style={tx.emptySubText}>The scheduler captures state automatically.</Text>
            </View>
          )}

          <Text style={tx.footer}>
            {logs.length} snapshot{logs.length !== 1 ? 's' : ''} · refreshes every 30s
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles — separated by type so TypeScript stays happy ─────────────────────

const vx = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: H_PAD, paddingTop: 56, paddingBottom: SPACING.md },
  refreshBtn:      { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.glassBorder },
  scroll:          { padding: H_PAD, paddingBottom: 120, gap: SPACING.md },
  centered:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxxl, gap: SPACING.md },
  totalsRow:       { flexDirection: 'row', gap: SPACING.sm },
  totalsCard:      { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.glassBorder },
  card:            { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.xl, borderWidth: 1, borderColor: COLORS.glassBorder },
  chartHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACING.sm },
  rangeRow:        { flexDirection: 'row', gap: 4 },
  rangeBtn:        { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.glassBorder },
  rangeBtnActive:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tilesGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  statTile:        { width: '47%', backgroundColor: COLORS.glass, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.glassBorder, overflow: 'hidden' },
  statTileBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: COLORS.glass },
  statTileBarFill: { height: '100%', borderRadius: 2 },
  retryBtn:        { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, backgroundColor: COLORS.accent, borderRadius: RADIUS.full },
  roomHeader:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  roomDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  roomToggleBtn:  { marginLeft: 'auto', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.glassBorder },
});

const tx = StyleSheet.create({
  headerTitle:        { color: COLORS.text, fontSize: 24, fontWeight: FONTS.bold, letterSpacing: -0.3 },
  refreshBtnText:     { color: COLORS.accent, fontSize: 18 },
  totalsValue:        { color: COLORS.accent, fontSize: 22, fontWeight: FONTS.bold },
  totalsLabel:        { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'center' },
  cardTitle:          { color: COLORS.text, fontSize: 15, fontWeight: FONTS.semibold },
  cardSubtitle:       { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  rangeBtnText:       { color: COLORS.textMuted, fontSize: 11, fontWeight: FONTS.medium },
  rangeBtnTextActive: { color: COLORS.text },
  ganttLabel:         { color: COLORS.textSecondary, fontSize: 11, fontWeight: FONTS.medium },
  axisLabel:          { color: COLORS.textMuted, fontSize: 9 },
  statTileId:         { color: COLORS.textSecondary, fontSize: 13, fontWeight: FONTS.semibold },
  statTilePct:        { fontSize: 20, fontWeight: FONTS.bold, marginTop: 2 },
  statTileSub:        { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  errorText:          { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14 },
  retryBtnText:       { color: COLORS.text, fontWeight: FONTS.semibold },
  emptyText:          { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
  emptySubText:       { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  footer:             { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: SPACING.sm },
  roomToggleBtnText: { color: COLORS.textMuted, fontSize: 11 },
});