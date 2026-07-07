import React, { useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// iOS-alarm-style scroll wheel. Each column is a snapping vertical ScrollView;
// items fade + shrink with distance from the centre selection band.
const ITEM_HEIGHT = 44;
const VISIBLE = 5; // odd, so one row sits dead-centre
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE;
const PAD = ITEM_HEIGHT * Math.floor(VISIBLE / 2);

// ── One item inside a wheel ────────────────────────────────────────────────
interface WheelItemProps {
  label: string;
  index: number;
  scrollY: SharedValue<number>;
  colors: ThemeColors;
}

const WheelItem: React.FC<WheelItemProps> = ({ label, index, scrollY, colors }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const pos = index * ITEM_HEIGHT;
    const distance = Math.abs(scrollY.value - pos) / ITEM_HEIGHT;
    const opacity = interpolate(distance, [0, 1, 2], [1, 0.45, 0.18], Extrapolation.CLAMP);
    const scale = interpolate(distance, [0, 1, 2], [1, 0.86, 0.72], Extrapolation.CLAMP);
    const color = interpolateColor(distance, [0, 1], [colors.accent, colors.textSecondary]);
    return { opacity, color, transform: [{ scale }] };
  });

  return (
    <View style={styles.item}>
      <Animated.Text style={[styles.itemText, animatedStyle]}>{label}</Animated.Text>
    </View>
  );
};

// ── One wheel column ───────────────────────────────────────────────────────
interface WheelColumnProps {
  data: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  colors: ThemeColors;
  width: number;
}

const WheelColumn: React.FC<WheelColumnProps> = ({ data, selectedIndex, onChange, colors, width }) => {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollY = useSharedValue(selectedIndex * ITEM_HEIGHT);
  const lastIndex = useRef(selectedIndex);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // Land on the initial value once the column has mounted/measured.
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync when the value changes from outside (e.g. the form is reset for a
  // different schedule) — but not when the change came from our own scrolling.
  useEffect(() => {
    if (selectedIndex !== lastIndex.current) {
      lastIndex.current = selectedIndex;
      scrollY.value = selectedIndex * ITEM_HEIGHT;
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(y / ITEM_HEIGHT)));
    if (idx !== lastIndex.current) {
      lastIndex.current = idx;
      Haptics.selectionAsync().catch(() => {});
      onChange(idx);
    }
  };

  return (
    <View style={{ height: CONTAINER_HEIGHT, width }}>
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {data.map((item, index) => (
          <WheelItem key={index} label={item} index={index} scrollY={scrollY} colors={colors} />
        ))}
      </Animated.ScrollView>
    </View>
  );
};

// ── Time picker (hour · minute · AM/PM) ────────────────────────────────────
interface WheelTimePickerProps {
  hour: number;   // 0–23
  minute: number; // 0–59
  onChange: (hour: number, minute: number) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

const WheelTimePicker: React.FC<WheelTimePickerProps> = ({ hour, minute, onChange }) => {
  const { colors } = useTheme();
  const styles2 = useMemo(() => createStyles(colors), [colors]);

  const hour12Index = (hour % 12 || 12) - 1;     // 0–11
  const periodIndex = hour >= 12 ? 1 : 0;

  const compose = (h12Index: number, pIndex: number) =>
    ((h12Index + 1) % 12) + (pIndex === 1 ? 12 : 0);

  return (
    <View style={styles2.card}>
      {/* centre selection band */}
      <View pointerEvents="none" style={styles2.band} />

      <View style={styles2.row}>
        <WheelColumn
          data={HOURS}
          selectedIndex={hour12Index}
          onChange={(i) => onChange(compose(i, periodIndex), minute)}
          colors={colors}
          width={58}
        />
        <Text style={styles2.colon}>:</Text>
        <WheelColumn
          data={MINUTES}
          selectedIndex={minute}
          onChange={(i) => onChange(hour, i)}
          colors={colors}
          width={58}
        />
        <WheelColumn
          data={PERIODS}
          selectedIndex={periodIndex}
          onChange={(i) => onChange(compose(hour12Index, i), minute)}
          colors={colors}
          width={58}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.md,
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: CONTAINER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    height: ITEM_HEIGHT,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.accentGlow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colon: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: '700',
    marginHorizontal: 2,
  },
});

export default WheelTimePicker;
