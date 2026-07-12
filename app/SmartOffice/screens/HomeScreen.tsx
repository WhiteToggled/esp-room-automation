import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { SPACING, RADIUS, ThemeColors } from '../constants/theme';
import { Cabin, INITIAL_CABINS } from '../constants/cabinData';
import * as devicesApi from '../api/devices';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getBiometricCapability, isEnrolledLocally } from '../api/biometric';
import Header from '../components/Header';
import Loader from '../components/Loader';
import DraggableCabinGrid from '../components/DraggableCabinGrid';
import BottomNav, { TabName } from '../components/BottomNav';
import MasterControl from '../components/MasterControl';
import ExpandedCabinModal from '../components/ExpandedCabinModal';
import AdminUsersScreen from './AdminUsersScreen';
import AnalyticsScreen from './AnalyticsScreen';
import SchedulesScreen from './SchedulesScreen';
import SettingsScreen from './SettingsScreen';
import LogsScreen from './LogsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Persisted admin-defined ordering of the cabin grid (drag-to-rearrange).
const CABIN_ORDER_KEY = 'nestboard_cabin_order';

const TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };

// Tab order: Home=0, Schedules=1, Analytics=2, Users=3, Settings=4, Logs=5
const ADMIN_OFFSETS: Record<TabName, number> = { home: 0, schedules: 1, analytics: 2, users: 3, settings: 4, logs: 5 };
const USER_OFFSETS:  Record<TabName, number> = { home: 0, schedules: 1, analytics: 0, users: 0, settings: 0, logs: 0 };
const tabOffset = (tab: TabName, isAdmin: boolean): number =>
  (isAdmin ? ADMIN_OFFSETS : USER_OFFSETS)[tab];

const HomeScreen: React.FC = () => {
  const { user, logout, enableBiometric } = useAuth();
  const { colors, theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cabins, setCabins] = useState<Cabin[]>(INITIAL_CABINS);
  // True until the first /states fetch settles — until then we show the loader
  // instead of the seeded (dummy) on/off states from INITIAL_CABINS.
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [expandedCabinId, setExpandedCabinId] = useState<string | null>(null);
  // While a cabin card is being dragged, freeze the page scroll so the gesture
  // doesn't fight the vertical ScrollView.
  const [isDragging, setIsDragging] = useState(false);

  const isAdmin = user?.role === 'admin';
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  // Other tabs only mount the first time they're visited (and then stay mounted) —
  // on app open this avoids firing four screens' worth of fetches/renders at once
  // for work the user isn't even looking at yet.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabName>>(() => new Set(['home']));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);

  // One-time nudge, per user, to set up biometric login after a password sign-in.
  // Only shown when the device supports biometrics and isn't already enrolled.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const dismissKey = `nestboard_bio_prompted_${user.id}`;
      const [prompted, cap, enrolled] = await Promise.all([
        AsyncStorage.getItem(dismissKey),
        getBiometricCapability(),
        isEnrolledLocally(),
      ]);
      if (cancelled || prompted || enrolled || !cap.available) return;
      // Mark shown up front so a re-render can't stack a second alert.
      await AsyncStorage.setItem(dismissKey, '1');
      Alert.alert(
        `Enable ${cap.label} login?`,
        `Sign in faster next time using ${cap.label} on this device.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const res = await enableBiometric();
              Alert.alert(
                res.success ? 'All set' : 'Could not enable',
                res.success
                  ? `${cap.label} login is now enabled on this device.`
                  : res.error || 'Please try again from this device.',
              );
            },
          },
        ],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user, enableBiometric]);

  // Ordered list of tabs visible to this user — used for swipe navigation
  const visibleTabs: TabName[] = isAdmin
    ? ['home', 'schedules', 'analytics', 'users', 'settings', 'logs']
    : ['home', 'schedules'];

  const handleSwipe = useCallback((translationX: number) => {
    const idx = visibleTabs.indexOf(activeTab);
    if (translationX < -60 && idx < visibleTabs.length - 1) {
      setActiveTab(visibleTabs[idx + 1]);
    } else if (translationX > 60 && idx > 0) {
      setActiveTab(visibleTabs[idx - 1]);
    }
  }, [activeTab, visibleTabs]);

  // Keep a ref so PanResponder (created once) always calls the latest handleSwipe
  const handleSwipeRef = useRef(handleSwipe);
  useEffect(() => { handleSwipeRef.current = handleSwipe; }, [handleSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      // Claim the gesture only when horizontal movement is clear and dominant
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) * 1.5 && Math.abs(g.dx) > 15,
      onPanResponderRelease:   (_, g) => { handleSwipeRef.current(g.dx); },
      onPanResponderTerminate: (_, g) => { handleSwipeRef.current(g.dx); },
    })
  ).current;

  // offset drives all slide animations
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withTiming(tabOffset(activeTab, isAdmin), TIMING);
  }, [activeTab, isAdmin, offset]);

  // Home is always at position 0 — slides left as offset increases
  const homeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * -SCREEN_WIDTH }],
  }));

  // Schedules: always position 1 (both admin and non-admin)
  const schedulesAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - offset.value) * SCREEN_WIDTH }],
  }));

  // Analytics: position 2 (admin only)
  const analyticsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (2 - offset.value) * SCREEN_WIDTH }],
  }));

  // Users: position 3 (admin only)
  const usersAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (3 - offset.value) * SCREEN_WIDTH }],
  }));

  // Settings: position 4 (admin only)
  const settingsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (4 - offset.value) * SCREEN_WIDTH }],
  }));

  // Logs: always position 5 (admin only)
  const logsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (5 - offset.value) * SCREEN_WIDTH }],
  }));

  const assignedCabinIds = user?.assignedCabinIds ?? [];
  const visibleCabins = useMemo(
    () => (isAdmin ? cabins : cabins.filter((c) => assignedCabinIds.includes(c.id))),
    [cabins, isAdmin, assignedCabinIds.join(',')]
  );

  // Kept in sync with `cabins` so the toggle callbacks below can read current
  // state (for the MQTT topic lookup) without depending on `cabins` directly —
  // that keeps their identity stable across polls, which lets CabinCard skip
  // re-rendering for every cabin except the one that actually changed.
  const cabinsRef = useRef(cabins);
  useEffect(() => { cabinsRef.current = cabins; }, [cabins]);

  // Restore the admin's saved drag ordering once on mount. Any cabin missing
  // from the saved list (e.g. added later) keeps its default position at the end.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(CABIN_ORDER_KEY);
        if (!saved) return;
        const order: string[] = JSON.parse(saved);
        if (!Array.isArray(order)) return;
        setCabins((prev) => {
          const rank = new Map(order.map((id, i) => [id, i]));
          const next = [...prev].sort(
            (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
          );
          return next;
        });
      } catch (_) {}
    })();
  }, []);

  const handleReorder = useCallback((orderedIds: string[]) => {
    setCabins((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Cabin[];
      // Preserve any cabin not present in the reordered list (defensive).
      for (const c of prev) if (!orderedIds.includes(c.id)) next.push(c);
      return next;
    });
    AsyncStorage.setItem(CABIN_ORDER_KEY, JSON.stringify(orderedIds)).catch(() => {});
  }, []);

  // Topics we've just optimistically changed, mapped to the value we expect the
  // server to settle on (1/0). While a topic is "pending", reconcileStates ignores
  // any incoming /states value that DOESN'T match the expected one — that stops an
  // in-flight (stale) poll from resurrecting the old state and causing the flicker.
  // The lock releases the moment a poll reports the expected value.
  const pendingRef = useRef<Record<string, number>>({});

  const markPending = useCallback((topic: string | undefined, on: boolean) => {
    if (!topic) return;
    pendingRef.current[topic] = on ? 1 : 0;
    // Safety net: never hold the lock forever if the device/broker never confirms.
    setTimeout(() => { delete pendingRef.current[topic]; }, 8000);
  }, []);

  // Maps every cabin through `updater`, but reuses the previous cabin object
  // (and the previous array, if nothing changed at all) wherever the updater
  // reports no change — so polling that finds nothing new triggers zero re-renders.
  const applyCabinUpdate = useCallback((updater: (c: Cabin) => Cabin) => {
    setCabins((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const updated = updater(c);
        if (updated !== c) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, []);

  const toggleLight = useCallback((cabinId: string) => {
    const cabin = cabinsRef.current.find((c) => c.id === cabinId);
    const topic = cabin?.light.topic;
    const nextOn = cabin ? !cabin.light.isOn : false;
    applyCabinUpdate((c) => (c.id === cabinId ? { ...c, light: { ...c.light, isOn: !c.light.isOn } } : c));
    if (topic) {
      markPending(topic, nextOn);
      devicesApi.setDevice(topic, nextOn ? 1 : 0).catch(async () => {
        delete pendingRef.current[topic]; // request failed — let reconcile correct us
        try {
          const states = await devicesApi.getStates();
          reconcileStates(states);
        } catch (_) {}
      });
    }
  }, [applyCabinUpdate, markPending]);

  const toggleFan = useCallback((cabinId: string) => {
    const cabin = cabinsRef.current.find((c) => c.id === cabinId);
    const topic = cabin?.fan.topic;
    const nextOn = cabin ? !cabin.fan.isOn : false;
    applyCabinUpdate((c) => (c.id === cabinId ? { ...c, fan: { ...c.fan, isOn: !c.fan.isOn } } : c));
    if (topic) {
      markPending(topic, nextOn);
      devicesApi.setDevice(topic, nextOn ? 1 : 0).catch(async () => {
        delete pendingRef.current[topic];
        try {
          const states = await devicesApi.getStates();
          reconcileStates(states);
        } catch (_) {}
      });
    }
  }, [applyCabinUpdate, markPending]);

  const allLightsOn = useCallback(() => {
    cabinsRef.current.forEach((c) => markPending(c.light.topic, true));
    applyCabinUpdate((c) => (c.light.isOn ? c : { ...c, light: { ...c.light, isOn: true } }));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, [applyCabinUpdate, markPending]);

  const allFansOn = useCallback(() => {
    cabinsRef.current.forEach((c) => markPending(c.fan.topic, true));
    applyCabinUpdate((c) => (c.fan.isOn ? c : { ...c, fan: { ...c.fan, isOn: true } }));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, [applyCabinUpdate, markPending]);

  const allOff = useCallback(() => {
    cabinsRef.current.forEach((c) => {
      markPending(c.light.topic, false);
      markPending(c.fan.topic, false);
    });
    applyCabinUpdate((c) =>
      !c.light.isOn && !c.fan.isOn
        ? c
        : { ...c, light: { ...c.light, isOn: false }, fan: { ...c.fan, isOn: false } }
    );
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, [applyCabinUpdate, markPending]);

  const reconcileStates = useCallback((data: devicesApi.StatesResponse) => {
    const { states, names } = data;
    const pending = pendingRef.current;
    // For a device with a pending change, only accept the incoming value once it
    // matches what we expect (then release the lock); otherwise keep the optimistic
    // value so a stale/echoed poll can't flip it back.
    const resolve = (topic: string | undefined, currentOn: boolean): boolean => {
      if (!topic) return currentOn;
      const incoming = Boolean(states[topic]);
      const expected = pending[topic];
      if (expected !== undefined) {
        if (Number(incoming) === expected) {
          delete pending[topic];
          return incoming;
        }
        return currentOn;
      }
      return incoming;
    };
    applyCabinUpdate((c) => {
      const lightOn = resolve(c.light.topic, c.light.isOn);
      const fanOn = resolve(c.fan.topic, c.fan.isOn);
      // Server-provided room name wins; an unnamed room comes back as its own
      // id (e.g. "r2"), in which case we keep the friendly default label.
      const roomId = `r${c.number}`;
      const serverName = names[roomId];
      const nextName = serverName && serverName !== roomId ? serverName : c.name;
      if (lightOn === c.light.isOn && fanOn === c.fan.isOn && nextName === c.name) return c;
      return { ...c, name: nextName, light: { ...c.light, isOn: lightOn }, fan: { ...c.fan, isOn: fanOn } };
    });
  }, [applyCabinUpdate]);

  // Rename a cabin's room (admin). Applies optimistically and reverts on failure.
  const renameCabin = useCallback(async (cabinId: string, rawName: string) => {
    const cabin = cabinsRef.current.find((c) => c.id === cabinId);
    const name = rawName.trim();
    if (!cabin || !name || name === cabin.name) return;
    const roomId = `r${cabin.number}`;
    const previous = cabin.name;
    applyCabinUpdate((c) => (c.id === cabinId ? { ...c, name } : c));
    try {
      await devicesApi.renameRoom(roomId, name);
    } catch (_) {
      applyCabinUpdate((c) => (c.id === cabinId ? { ...c, name: previous } : c));
      Alert.alert('Rename failed', 'Could not rename this cabin. Please try again.');
    }
  }, [applyCabinUpdate]);

  useEffect(() => {
    let mounted = true;

    const fetchAndReconcile = async () => {
      try {
        const states = await devicesApi.getStates();
        if (mounted) reconcileStates(states);
      } catch (_) {
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };

    fetchAndReconcile();
    const interval = setInterval(fetchAndReconcile, 5000);

    return () => { mounted = false; clearInterval(interval); };
  }, [reconcileStates]);

  const activeDevices = visibleCabins.reduce(
    (acc, c) => acc + (c.light.isOn ? 1 : 0) + (c.fan.isOn ? 1 : 0),
    0
  );
  const totalDevices = visibleCabins.length * 2;

  const expandedCabin = cabins.find((c) => c.id === expandedCabinId) ?? null;

  const hasNoCabin = !isAdmin && assignedCabinIds.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      {/* Sliding pages with swipe-left/right navigation */}
      <View style={styles.pages} {...panResponder.panHandlers}>

        {/* Home tab */}
        <Animated.View
          style={[StyleSheet.absoluteFill, homeAnimStyle]}
          pointerEvents={activeTab === 'home' ? 'auto' : 'none'}
        >
          <SafeAreaView style={styles.safeArea} edges={['top']}>
            <Header
              activeDevices={initialLoading ? 0 : activeDevices}
              totalDevices={totalDevices}
              userName={user?.name}
              cabinCount={visibleCabins.length}
              onLogout={logout}
            />

            {initialLoading ? (
              <Loader />
            ) : hasNoCabin ? (
              <View style={styles.noCabin}>
                <View style={styles.noCabinIcon}>
                  <Ionicons name="time-outline" size={36} color={colors.textMuted} />
                </View>
                <Text style={styles.noCabinTitle}>Awaiting Assignment</Text>
                <Text style={styles.noCabinSubtitle}>
                  Your account is active but no cabin has been assigned yet.{'\n'}
                  Please contact the admin.
                </Text>
                <View style={styles.noCabinHint}>
                  <Ionicons name="person-outline" size={13} color={colors.accent} />
                  <Text style={styles.noCabinHintText}>admin@nestboard.com</Text>
                </View>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isDragging}
              >
                {isAdmin && (
                  <MasterControl
                    onAllLightsOn={allLightsOn}
                    onAllFansOn={allFansOn}
                    onAllOff={allOff}
                  />
                )}
                <DraggableCabinGrid
                  cabins={visibleCabins}
                  onReorder={handleReorder}
                  onDragStateChange={setIsDragging}
                  onToggleLight={toggleLight}
                  onToggleFan={toggleFan}
                  onExpand={setExpandedCabinId}
                />
              </ScrollView>
            )}
          </SafeAreaView>
        </Animated.View>

        {/* Schedules tab (all users) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, schedulesAnimStyle]}
          pointerEvents={activeTab === 'schedules' ? 'auto' : 'none'}
        >
          {visitedTabs.has('schedules') && <SchedulesScreen />}
        </Animated.View>

        {/* Users tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, usersAnimStyle]}
            pointerEvents={activeTab === 'users' ? 'auto' : 'none'}
          >
            {visitedTabs.has('users') && <AdminUsersScreen refreshKey={usersRefreshKey} />}
          </Animated.View>
        )}

        {/* Settings tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, settingsAnimStyle]}
            pointerEvents={activeTab === 'settings' ? 'auto' : 'none'}
          >
            {visitedTabs.has('settings') && (
              <SettingsScreen
                isActive={activeTab === 'settings'}
                onUserChanged={() => setUsersRefreshKey((k) => k + 1)}
              />
            )}
          </Animated.View>
        )}

        {/* Logs tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, logsAnimStyle]}
            pointerEvents={activeTab === 'logs' ? 'auto' : 'none'}
          >
            {visitedTabs.has('logs') && <LogsScreen isActive={activeTab === 'logs'} />}
          </Animated.View>
        )}

        {/* Analytics tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, analyticsAnimStyle]}
            pointerEvents={activeTab === 'analytics' ? 'auto' : 'none'}
          >
            <AnalyticsScreen />
          </Animated.View>
        )}
      </View>

      {/* Bottom nav — all logged-in users */}
      <SafeAreaView edges={['bottom']} style={styles.navWrapper}>
        <BottomNav activeTab={activeTab} isAdmin={isAdmin} onTabChange={setActiveTab} />

      </SafeAreaView>

      <ExpandedCabinModal
        cabin={expandedCabin}
        canRename={isAdmin || (!!expandedCabin && assignedCabinIds.includes(expandedCabin.id))}
        onClose={() => setExpandedCabinId(null)}
        onToggleLight={() => expandedCabin && toggleLight(expandedCabin.id)}
        onToggleFan={() => expandedCabin && toggleFan(expandedCabin.id)}
        onRename={(name) => expandedCabin && renameCabin(expandedCabin.id, name)}
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pages: { flex: 1, overflow: 'hidden' },
  safeArea: { flex: 1 },
  glowTopLeft: {
    position: 'absolute', top: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(47,128,237,0.08)',
  },
  glowBottomRight: {
    position: 'absolute', bottom: 80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(47,128,237,0.05)',
  },
  grid: {
    paddingHorizontal: SPACING.xl - SPACING.sm / 2,
    paddingBottom: SPACING.xl,
  },
  navWrapper: { backgroundColor: 'transparent' },
  noCabin: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  noCabinIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.glass,
    borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  noCabinTitle: {
    color: colors.text, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.4, marginBottom: SPACING.sm,
  },
  noCabinSubtitle: {
    color: colors.textMuted, fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  noCabinHint: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(47,128,237,0.08)',
    borderWidth: 1, borderColor: 'rgba(47,128,237,0.2)',
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  noCabinHintText: { color: colors.accent, fontSize: 13, fontWeight: '500', marginLeft: SPACING.xs },
});

export default HomeScreen;
