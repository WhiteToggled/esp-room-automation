import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { lightsOn, fansOn, allOff as apiAllOff } from '../api/devices';

interface MasterControlProps {
  onAllLightsOn: () => void;
  onAllFansOn: () => void;
  onAllOff: () => void;
}

type BtnStatus = 'idle' | 'busy' | 'done';

// Solid fill colors used while a button is working / just finished, so a tap is
// unmistakable even before the network round-trip completes.
const ACTIVE_ACCENT = '#2f80ed';
const ACTIVE_DANGER = '#ff5050';

interface MasterButtonProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  isLast?: boolean;
  // When set, the button must be held for this many ms before it fires — guards a
  // destructive action (All Off) against accidental taps. A quick tap only hints.
  holdMs?: number;
  // Fires the API request. The optimistic UI update (onAfter) runs regardless of
  // whether this rejects, matching the previous fire-and-forget behavior.
  request: () => Promise<unknown>;
  onAfter: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const MasterButton: React.FC<MasterButtonProps> = ({
  label, icon, danger, isLast, holdMs, request, onAfter, colors, styles,
}) => {
  const [status, setStatus] = useState<BtnStatus>('idle');
  const [hint, setHint] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current; // hold progress, 0→1
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const mounted = useRef(true);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHold = !!holdMs;

  useEffect(() => () => {
    mounted.current = false;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const springTo = useCallback((to: number) => {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }, [scale]);

  const runAction = useCallback(async () => {
    if (status === 'busy') return; // ignore re-entry while a request is in flight
    setStatus('busy');
    try {
      await request();
    } catch (_) {
      // swallow — the optimistic update below keeps the UI responsive; the Home
      // screen's polling reconciles the true state shortly after.
    }
    onAfter();
    if (!mounted.current) return;
    setStatus('done');
    resetTimer.current = setTimeout(() => {
      if (mounted.current) setStatus('idle');
    }, 900);
  }, [status, request, onAfter]);

  // ── Hold-to-confirm (destructive buttons) ────────────────────────────────
  const startHold = useCallback(() => {
    if (status !== 'idle') return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1, duration: holdMs, useNativeDriver: false,
    });
    holdAnim.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        progress.setValue(0);
        runAction();
      }
    });
  }, [status, holdMs, progress, runAction]);

  const cancelHold = useCallback(() => {
    holdAnim.current?.stop();
    holdAnim.current = null;
    Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  }, [progress]);

  const handlePress = useCallback(() => {
    if (isHold) {
      // A quick tap on a hold button shouldn't fire — nudge the user to hold.
      if (status === 'idle') {
        setHint(true);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => { if (mounted.current) setHint(false); }, 1400);
      }
      return;
    }
    runAction();
  }, [isHold, status, runAction]);

  const active = status !== 'idle';
  const activeFill = danger ? ACTIVE_DANGER : ACTIVE_ACCENT;
  const contentColor = active || danger ? '#fff' : colors.accent;
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const displayLabel = status === 'done' ? 'Done' : hint ? `Hold ${Math.round((holdMs ?? 0) / 1000)}s` : label;

  return (
    <Animated.View style={[styles.btnWrap, !isLast && styles.btnGap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => { springTo(0.94); if (isHold) startHold(); }}
        onPressOut={() => { springTo(1); if (isHold) cancelHold(); }}
        disabled={status === 'busy'}
        style={[
          styles.btn,
          danger && styles.btnDanger,
          active && { backgroundColor: activeFill, borderColor: activeFill },
        ]}
      >
        {isHold && (
          <Animated.View
            pointerEvents="none"
            style={[styles.holdFill, { backgroundColor: activeFill, width: progressWidth }]}
          />
        )}
        {status === 'busy' ? (
          <ActivityIndicator size="small" color={contentColor} />
        ) : (
          <Ionicons name={status === 'done' ? 'checkmark' : icon} size={14} color={contentColor} />
        )}
        <Text style={[styles.btnText, (danger || active) && styles.btnTextOnFill]}>
          {displayLabel}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const MasterControl: React.FC<MasterControlProps> = ({
  onAllLightsOn,
  onAllFansOn,
  onAllOff,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Master Control</Text>

      <View style={styles.buttons}>
        <MasterButton
          label="All Lights On" icon="bulb"
          request={lightsOn} onAfter={onAllLightsOn}
          colors={colors} styles={styles}
        />
        <MasterButton
          label="All Fans On" icon="sync"
          request={fansOn} onAfter={onAllFansOn}
          colors={colors} styles={styles}
        />
        <MasterButton
          label="All Off" icon="power-outline" danger isLast holdMs={2000}
          request={apiAllOff} onAfter={onAllOff}
          colors={colors} styles={styles}
        />
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  title: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  buttons: {
    flexDirection: 'row',
  },

  btnWrap: {
    flex: 1,
  },

  btnGap: {
    marginRight: SPACING.xs,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(47,128,237,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(47,128,237,0.2)',
    overflow: 'hidden', // clip the hold-progress fill to the rounded corners
  },

  btnDanger: {
    backgroundColor: 'rgba(255,80,80,0.15)',
    borderColor: 'rgba(255,80,80,0.25)',
  },

  // Grows left→right behind the icon/label as the All Off button is held.
  holdFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },

  btnText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4, // replaces gap
  },

  btnTextOnFill: {
    color: '#fff',
  },
});

export default MasterControl;
