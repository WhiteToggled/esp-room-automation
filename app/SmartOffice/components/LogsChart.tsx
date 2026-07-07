import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import * as api from '../api/devices';
import { LogBucket, LogRangePeriod } from '../api/devices';

const CHART_HEIGHT = 200;
const GRID_LINES = [1, 0.75, 0.5, 0.25, 0];

const RANGES: { key: LogRangePeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

interface SeriesPoint {
  x: number;
  y: number;
}

interface ChartPoint {
  x: number;
  avgY: number;
  peakY: number;
  avg: number;
  peak: number;
  total: number;
  samples: number;
  time: string;
}

const formatAxisLabel = (iso: string, period: LogRangePeriod) => {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (period === 'day') return date.toLocaleTimeString(undefined, { hour: 'numeric' });
  if (period === 'week') return date.toLocaleDateString(undefined, { weekday: 'short' });
  return String(date.getDate());
};

const formatTooltipDate = (iso: string, period: LogRangePeriod) => {
  const date = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (period === 'day') {
    return date.toLocaleString(undefined, { weekday: 'short', hour: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ─── A reusable polyline + dots series (no SVG / no extra deps) ──────────────

const ChartSeries: React.FC<{
  points: SeriesPoint[];
  color: string;
  dashed?: boolean;
  dotSize?: number;
  styles: ReturnType<typeof createStyles>;
}> = ({ points, color, dashed, dotSize = 7, styles }) => (
  <>
    {points.slice(1).map((p, i) => {
      const prev = points[i];
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      return (
        <View
          key={`seg-${i}`}
          style={[
            styles.segment,
            dashed && styles.segmentDashed,
            {
              width: length,
              left: prev.x,
              top: prev.y - 1,
              backgroundColor: dashed ? 'transparent' : color,
              borderColor: color,
              transformOrigin: '0% 50%',
              transform: [{ rotate: `${angle}rad` }],
            },
          ]}
        />
      );
    })}
    {points.map((p, i) => (
      <View
        key={`dot-${i}`}
        style={[
          styles.dot,
          {
            left: p.x - dotSize / 2,
            top: p.y - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderColor: color,
          },
        ]}
      />
    ))}
  </>
);

// ─── Main chart ───────────────────────────────────────────────────────────────

interface LogsChartProps {
  isActive?: boolean;
}

const LogsChart: React.FC<LogsChartProps> = ({ isActive }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [period, setPeriod] = useState<LogRangePeriod>('week');
  const [buckets, setBuckets] = useState<LogBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartWidth, setChartWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const fetchData = useCallback(async (p: LogRangePeriod) => {
    setLoading(true);
    try {
      const data = await api.getLogsRange(p);
      setBuckets(data);
    } catch (_) {
      setBuckets([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setSelected(null);
    fetchData(period);
  }, [period, fetchData]);

  useEffect(() => {
    if (isActive) fetchData(period);
  }, [isActive, period, fetchData]);

  const totalDevices = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.total), 1),
    [buckets]
  );
  const hasData = buckets.some((b) => b.samples > 0);

  const points = useMemo<ChartPoint[]>(() => {
    if (buckets.length === 0 || chartWidth === 0) return [];
    const step = buckets.length > 1 ? chartWidth / (buckets.length - 1) : 0;
    return buckets.map((b, i) => ({
      x: buckets.length > 1 ? i * step : chartWidth / 2,
      avgY: CHART_HEIGHT - (b.avg_on / totalDevices) * CHART_HEIGHT,
      peakY: CHART_HEIGHT - (b.peak_on / totalDevices) * CHART_HEIGHT,
      avg: b.avg_on,
      peak: b.peak_on,
      total: b.total,
      samples: b.samples,
      time: b.bucket_start,
    }));
  }, [buckets, chartWidth, totalDevices]);

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const peakOfPeriod = points.reduce((acc, p) => Math.max(acc, p.peak), 0);
  const avgOfPeriod = points.length
    ? points.reduce((acc, p) => acc + p.avg, 0) / points.length
    : 0;

  const activePoint = selected !== null ? points[selected] : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Devices On</Text>
          <Text style={styles.subtitle}>
            {hasData
              ? `avg ${avgOfPeriod.toFixed(1)} · peak ${peakOfPeriod} of ${totalDevices}`
              : 'No data for this period'}
          </Text>
        </View>

        <View style={styles.tabs}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.tab, period === r.key && styles.tabActive]}
              onPress={() => setPeriod(r.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, period === r.key && styles.tabTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.chartRow}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          {GRID_LINES.map((g) => (
            <Text key={g} style={styles.yAxisLabel}>
              {Math.round(g * totalDevices)}
            </Text>
          ))}
        </View>

        <View
          style={styles.chartArea}
          onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
        >
          {/* Gridlines */}
          {GRID_LINES.map((g) => (
            <View key={g} style={[styles.gridLine, { top: g * CHART_HEIGHT }]} />
          ))}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : !hasData ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.emptyChartText}>Nothing logged yet</Text>
            </View>
          ) : (
            <>
              {/* Fill under the average line */}
              {points.map((p, i) => {
                const barWidth = chartWidth / Math.max(points.length - 1, 1) || 6;
                const left = Math.max(0, Math.min(chartWidth - barWidth, p.x - barWidth / 2));
                return (
                  <View
                    key={`fill-${i}`}
                    style={[
                      styles.fillBar,
                      {
                        left,
                        width: barWidth,
                        height: Math.max(CHART_HEIGHT - p.avgY, 1),
                      },
                    ]}
                  />
                );
              })}

              {/* Peak series (secondary, dashed) */}
              <ChartSeries
                points={points.map((p) => ({ x: p.x, y: p.peakY }))}
                color={colors.blue}
                dashed
                dotSize={5}
                styles={styles}
              />

              {/* Average series (primary) */}
              <ChartSeries
                points={points.map((p) => ({ x: p.x, y: p.avgY }))}
                color={colors.accent}
                dotSize={8}
                styles={styles}
              />

              {/* Touch targets for tooltip */}
              {points.map((p, i) => (
                <TouchableOpacity
                  key={`hit-${i}`}
                  style={[styles.hitZone, { left: p.x - 14 }]}
                  onPress={() => setSelected(selected === i ? null : i)}
                />
              ))}

              {activePoint && (
                <View
                  style={[
                    styles.tooltip,
                    {
                      left: Math.min(
                        Math.max(activePoint.x - 60, 0),
                        Math.max(chartWidth - 120, 0)
                      ),
                    },
                  ]}
                >
                  <Text style={styles.tooltipDate}>
                    {formatTooltipDate(activePoint.time, period)}
                  </Text>
                  <Text style={styles.tooltipLine}>
                    <Text style={{ color: colors.accent }}>● </Text>
                    avg {activePoint.avg.toFixed(1)}
                  </Text>
                  <Text style={styles.tooltipLine}>
                    <Text style={{ color: colors.blue }}>● </Text>
                    peak {activePoint.peak} / {activePoint.total}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>

      {/* X-axis labels */}
      {points.length > 0 && (
        <View style={styles.xAxisRow}>
          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <Text key={i} style={[styles.xAxisLabel, { position: 'absolute', left: p.x - 16 }]}>
                {formatAxisLabel(p.time, period)}
              </Text>
            ) : null
          )}
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Average on</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.legendDotPeak, { borderColor: colors.blue }]} />
          <Text style={styles.legendText}>Peak on</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendSwatchFill} />
          <Text style={styles.legendText}>Out of {totalDevices} device{totalDevices !== 1 ? 's' : ''}</Text>
        </View>
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.full,
    padding: 3,
  },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  chartRow: { flexDirection: 'row' },
  yAxis: {
    width: 28,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    marginRight: SPACING.sm,
  },
  yAxisLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  chartArea: { flex: 1, height: CHART_HEIGHT },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },

  fillBar: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'rgba(47,128,237,0.12)',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  segment: { position: 'absolute', height: 2 },
  segmentDashed: { borderTopWidth: 2, borderStyle: 'dashed', height: 0 },
  dot: { position: 'absolute', backgroundColor: colors.background, borderWidth: 2 },
  hitZone: { position: 'absolute', top: 0, width: 28, height: CHART_HEIGHT },

  tooltip: {
    position: 'absolute',
    top: 4,
    width: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  tooltipDate: { color: colors.text, fontSize: 11, fontWeight: '700', marginBottom: 3 },
  tooltipLine: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },

  xAxisRow: { height: 16, marginTop: SPACING.xs, marginLeft: 28 + SPACING.sm },
  xAxisLabel: { width: 32, textAlign: 'center', color: colors.textMuted, fontSize: 10, fontWeight: '600' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendDotPeak: { backgroundColor: 'transparent', borderWidth: 2 },
  legendSwatchFill: {
    width: 9, height: 9, borderRadius: 2,
    backgroundColor: 'rgba(47,128,237,0.18)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.3)',
  },
  legendText: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
});

export default LogsChart;
