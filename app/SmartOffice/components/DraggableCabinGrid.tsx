import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Cabin } from '../constants/cabinData';
import { SPACING } from '../constants/theme';
import CabinCard from './CabinCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Must match HomeScreen's `grid` contentContainer paddingHorizontal so the cell
// math lines up exactly with the old FlatList layout.
const GRID_H_PAD = SPACING.xl - SPACING.sm / 2; // 16
const NUM_COLUMNS = 2;
const CONTAINER_WIDTH = SCREEN_WIDTH - GRID_H_PAD * 2;
const CELL_WIDTH = CONTAINER_WIDTH / NUM_COLUMNS;
// Card visual height (170 min) + the sm/2 margins CabinCard's wrapper adds on
// each side. Fixed so cells can be absolutely positioned for the sortable grid.
const CELL_HEIGHT = 190;

const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

// --- layout math (worklet-safe) ---------------------------------------------

function getPosition(index: number) {
  'worklet';
  const col = index % NUM_COLUMNS;
  const row = Math.floor(index / NUM_COLUMNS);
  return { x: col * CELL_WIDTH, y: row * CELL_HEIGHT };
}

function getOrder(x: number, y: number, count: number) {
  'worklet';
  const col = Math.max(0, Math.min(NUM_COLUMNS - 1, Math.round(x / CELL_WIDTH)));
  const maxRow = Math.floor((count - 1) / NUM_COLUMNS);
  const row = Math.max(0, Math.min(maxRow, Math.round(y / CELL_HEIGHT)));
  return Math.max(0, Math.min(count - 1, row * NUM_COLUMNS + col));
}

// ----------------------------------------------------------------------------

type Positions = Record<string, number>;

interface DraggableCabinGridProps {
  cabins: Cabin[];
  onReorder: (orderedIds: string[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
  onToggleLight: (cabinId: string) => void;
  onToggleFan: (cabinId: string) => void;
  onExpand: (cabinId: string) => void;
}

interface SortableItemProps {
  cabin: Cabin;
  index: number;
  count: number;
  positions: SharedValue<Positions>;
  onDragStart: () => void;
  onDrop: () => void;
  onToggleLight: (cabinId: string) => void;
  onToggleFan: (cabinId: string) => void;
  onExpand: (cabinId: string) => void;
}

const hapticTick = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

const SortableItem: React.FC<SortableItemProps> = ({
  cabin,
  index,
  count,
  positions,
  onDragStart,
  onDrop,
  onToggleLight,
  onToggleFan,
  onExpand,
}) => {
  const start = getPosition(index);
  const translateX = useSharedValue(start.x);
  const translateY = useSharedValue(start.y);
  const isActive = useSharedValue(false);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Follow the shared order whenever this card is not the one being dragged.
  useAnimatedReaction(
    () => positions.value[cabin.id],
    (next) => {
      if (next == null || isActive.value) return;
      const p = getPosition(next);
      translateX.value = withSpring(p.x, SPRING);
      translateY.value = withSpring(p.y, SPRING);
    }
  );

  const pan = Gesture.Pan()
    // Pick the card up on a short hold, then it follows the finger. The hold is
    // what lets a normal tap (toggle/expand) and vertical scroll still work.
    .activateAfterLongPress(150)
    .onStart(() => {
      isActive.value = true;
      scale.value = withSpring(1.06, SPRING);
      startX.value = translateX.value;
      startY.value = translateY.value;
      runOnJS(onDragStart)();
      runOnJS(hapticTick)();
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;

      const oldIndex = positions.value[cabin.id];
      const newIndex = getOrder(translateX.value, translateY.value, count);
      if (newIndex !== oldIndex) {
        const updated: Positions = { ...positions.value };
        // Shift the card currently occupying the target slot into the old slot.
        for (const key in updated) {
          if (updated[key] === newIndex) updated[key] = oldIndex;
        }
        updated[cabin.id] = newIndex;
        positions.value = updated;
      }
    })
    .onEnd(() => {
      const p = getPosition(positions.value[cabin.id]);
      translateX.value = withSpring(p.x, SPRING);
      translateY.value = withSpring(p.y, SPRING);
    })
    .onFinalize(() => {
      isActive.value = false;
      scale.value = withSpring(1, SPRING);
      runOnJS(onDrop)();
    });

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    zIndex: isActive.value ? 999 : 0,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    shadowOpacity: withTiming(isActive.value ? 0.35 : 0, { duration: 150 }),
    elevation: isActive.value ? 12 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>
        <CabinCard
          cabin={cabin}
          index={index}
          onToggleLight={onToggleLight}
          onToggleFan={onToggleFan}
          onExpand={onExpand}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const DraggableCabinGrid: React.FC<DraggableCabinGridProps> = ({
  cabins,
  onReorder,
  onDragStateChange,
  onToggleLight,
  onToggleFan,
  onExpand,
}) => {
  const buildPositions = (list: Cabin[]): Positions => {
    const map: Positions = {};
    list.forEach((c, i) => { map[c.id] = i; });
    return map;
  };

  const positions = useSharedValue<Positions>(buildPositions(cabins));
  const draggingRef = useRef(false);

  // Re-sync the shared order when the cabin list changes externally (e.g. the
  // saved order loads from storage) — but never mid-drag, or we'd fight the
  // in-progress gesture. Toggling a device keeps the order identical, so the
  // per-id values don't change and no card actually moves.
  useEffect(() => {
    if (draggingRef.current) return;
    positions.value = buildPositions(cabins);
  }, [cabins]);

  const handleDragStart = () => {
    draggingRef.current = true;
    onDragStateChange?.(true);
  };

  const handleDrop = () => {
    draggingRef.current = false;
    onDragStateChange?.(false);
    const current = positions.value;
    const ordered = cabins
      .map((c) => c.id)
      .sort((a, b) => current[a] - current[b]);
    onReorder(ordered);
  };

  const rows = Math.ceil(cabins.length / NUM_COLUMNS);
  const containerStyle = useMemo(
    () => [styles.container, { width: CONTAINER_WIDTH, height: rows * CELL_HEIGHT }],
    [rows]
  );

  return (
    <View style={containerStyle}>
      {cabins.map((cabin, index) => (
        <SortableItem
          key={cabin.id}
          cabin={cabin}
          index={index}
          count={cabins.length}
          positions={positions}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onToggleLight={onToggleLight}
          onToggleFan={onToggleFan}
          onExpand={onExpand}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
});

export default DraggableCabinGrid;
