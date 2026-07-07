import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '../context/ThemeContext';
import { SPACING, ThemeColors } from '../constants/theme';

// Catchy lines that rotate while data is loading.
const DEFAULT_LINES = [
  'Waking up your cabins…',
  'Syncing live device states…',
  'Tuning the lights & fans…',
  'Almost ready…',
];

interface LoaderProps {
  /** Optional custom rotating messages. */
  lines?: string[];
  /** Diameter of the spinner ring in px. */
  size?: number;
}

const Loader: React.FC<LoaderProps> = ({ lines = DEFAULT_LINES, size = 66 }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Continuous rotation for the ring.
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  // Soft pulsing glow behind the ring.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45,
    transform: [{ scale: 0.9 + pulse.value * 0.25 }],
  }));

  // Rotate the catchy line every couple of seconds with a fade-in.
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), 2300);
    return () => clearInterval(id);
  }, [lines.length]);

  const textOpacity = useSharedValue(0);
  useEffect(() => {
    textOpacity.value = 0;
    textOpacity.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.ease) });
  }, [idx, textOpacity]);
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  const ringSize = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={styles.container}>
      <View style={styles.spinnerWrap}>
        <Animated.View
          style={[styles.glow, ringSize, { width: size * 1.35, height: size * 1.35, borderRadius: size }, glowStyle]}
        />
        <Animated.View
          style={[
            styles.ring,
            ringSize,
            { borderWidth: Math.max(3, size * 0.08) },
            ringStyle,
          ]}
        />
      </View>

      <Animated.Text style={[styles.line, textStyle]}>{lines[idx]}</Animated.Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxxl,
    },
    spinnerWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xl,
    },
    glow: {
      position: 'absolute',
      backgroundColor: colors.accentGlow,
    },
    ring: {
      borderColor: colors.glassBorder,
      // Two adjacent sides carry the accent → gives the "arc" that reads as a spinner.
      borderTopColor: colors.accent,
      borderRightColor: colors.accent,
    },
    line: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
      letterSpacing: 0.2,
      textAlign: 'center',
    },
  });

export default Loader;