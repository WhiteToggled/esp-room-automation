import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  Dimensions,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { Cabin, INITIAL_CABINS } from '../constants/cabinData';
import * as devicesApi from '../api/devices';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import CabinCard from '../components/CabinCard';
import BottomNav, { TabName } from '../components/BottomNav';
import MasterControl from '../components/MasterControl';
import AdminUsersScreen from './AdminUsersScreen';
import SchedulesScreen from './SchedulesScreen';
import SettingsScreen from './SettingsScreen';
import AnalyticsScreen from './AnalyticsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 2;

const TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };

// Tab order: Home=0, Schedules=1, Users=2, Settings=3
const ADMIN_OFFSETS: Record<TabName, number> = { home: 0, schedules: 1, users: 2, settings: 3 };
const USER_OFFSETS:  Record<TabName, number> = { home: 0, schedules: 1, users: 0, settings: 0 };
const tabOffset = (tab: TabName, isAdmin: boolean): number =>
  (isAdmin ? ADMIN_OFFSETS : USER_OFFSETS)[tab];

const HomeScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [cabins, setCabins] = useState<Cabin[]>(INITIAL_CABINS);
  const [activeTab, setActiveTab] = useState<TabName>('home');

  const isAdmin = user?.role === 'admin';
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  // Ordered list of tabs visible to this user — used for swipe navigation
  const visibleTabs: TabName[] = isAdmin
    ? ['home', 'schedules', 'users', 'settings']
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
  const TAB_INDEX = useMemo<Record<TabName, number>>(
    () => ({ home: 0, analytics: 1, users: 2 }),
    []
  );

  useEffect(() => {
    offset.value = withTiming(tabOffset(activeTab, isAdmin), TIMING);
  }, [activeTab, isAdmin]);

  // Home is always at position 0 — slides left as offset increases
  const homeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * -SCREEN_WIDTH }],
  }));

  // Schedules: always position 1 (both admin and non-admin)
  const schedulesAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - offset.value) * SCREEN_WIDTH }],
  }));

  // Users: position 2 (admin only)
  const usersAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (2 - offset.value) * SCREEN_WIDTH }],
  }));

  // Settings: always position 3 (admin only)
  const settingsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (3 - offset.value) * SCREEN_WIDTH }],
  }));

  const visibleCabins = useMemo(
    () => (isAdmin ? cabins : cabins.filter((c) => c.id === user?.assignedCabinId)),
    [cabins, isAdmin, user?.assignedCabinId]
  );

  const toggleLight = useCallback((cabinId: string) => {
    setCabins((prev) =>
      prev.map((c) =>
        c.id === cabinId ? { ...c, light: { ...c.light, isOn: !c.light.isOn } } : c
      )
    );
    const cabin = cabins.find((c) => c.id === cabinId);
    const topic = cabin?.light.topic;
    if (topic) {
      devicesApi.toggle(topic).catch(async () => {
        try {
          const states = await devicesApi.getStates();
          reconcileStates(states);
        } catch (_) {}
      });
    }
  }, [cabins]);

  const toggleFan = useCallback((cabinId: string) => {
    setCabins((prev) =>
      prev.map((c) =>
        c.id === cabinId ? { ...c, fan: { ...c.fan, isOn: !c.fan.isOn } } : c
      )
    );
    const cabin = cabins.find((c) => c.id === cabinId);
    const topic = cabin?.fan.topic;
    if (topic) {
      devicesApi.toggle(topic).catch(async () => {
        try {
          const states = await devicesApi.getStates();
          reconcileStates(states);
        } catch (_) {}
      });
    }
  }, [cabins]);

  const allLightsOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, light: { ...c.light, isOn: true } })));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const allFansOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, fan: { ...c.fan, isOn: true } })));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const allOff = useCallback(() => {
    setCabins((prev) =>
      prev.map((c) => ({
        ...c,
        light: { ...c.light, isOn: false },
        fan: { ...c.fan, isOn: false },
      }))
    );
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const reconcileStates = useCallback((states: Record<string, number>) => {
    setCabins((prev) =>
      prev.map((c) => ({
        ...c,
        light: { ...c.light, isOn: c.light.topic ? Boolean(states[c.light.topic]) : c.light.isOn },
        fan: { ...c.fan, isOn: c.fan.topic ? Boolean(states[c.fan.topic]) : c.fan.isOn },
      }))
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const states = await devicesApi.getStates();
        if (mounted) reconcileStates(states as Record<string, number>);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [reconcileStates]);

  const activeDevices = visibleCabins.reduce(
    (acc, c) => acc + (c.light.isOn ? 1 : 0) + (c.fan.isOn ? 1 : 0),
    0
  );
  const totalDevices = visibleCabins.length * 2;

  const renderCabin = ({ item }: { item: Cabin }) => (
    <CabinCard
      cabin={item}
      onToggleLight={() => toggleLight(item.id)}
      onToggleFan={() => toggleFan(item.id)}
      onPress={() => {}}
    />
  );

  const hasNoCabin = !isAdmin && !user?.assignedCabinId;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
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
              activeDevices={activeDevices}
              totalDevices={totalDevices}
              userName={user?.name}
              cabinCount={visibleCabins.length}
              onLogout={logout}
            />

            {hasNoCabin ? (
              <View style={styles.noCabin}>
                <View style={styles.noCabinIcon}>
                  <Ionicons name="time-outline" size={36} color={COLORS.textMuted} />
                </View>
                <Text style={styles.noCabinTitle}>Awaiting Assignment</Text>
                <Text style={styles.noCabinSubtitle}>
                  Your account is active but no cabin has been assigned yet.{'\n'}
                  Please contact the admin.
                </Text>
                <View style={styles.noCabinHint}>
                  <Ionicons name="person-outline" size={13} color={COLORS.accent} />
                  <Text style={styles.noCabinHintText}>admin@smartoffice.com</Text>
                </View>
              </View>
            ) : (
              <FlatList
                data={visibleCabins}
                renderItem={renderCabin}
                keyExtractor={(item) => item.id}
                numColumns={NUM_COLUMNS}
                contentContainerStyle={styles.grid}
                columnWrapperStyle={visibleCabins.length > 1 ? styles.row : undefined}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  isAdmin ? (
                    <MasterControl
                      onAllLightsOn={allLightsOn}
                      onAllFansOn={allFansOn}
                      onAllOff={allOff}
                    />
                  ) : null
                }
              />
            )}
          </SafeAreaView>
        </Animated.View>

        {/* Schedules tab (all users) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, schedulesAnimStyle]}
          pointerEvents={activeTab === 'schedules' ? 'auto' : 'none'}
        >
          <SchedulesScreen />
        </Animated.View>

        {/* Users tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, usersAnimStyle]}
            pointerEvents={activeTab === 'users' ? 'auto' : 'none'}
          >
            <AdminUsersScreen refreshKey={usersRefreshKey} />
          </Animated.View>
        )}

        {/* Settings tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, settingsAnimStyle]}
            pointerEvents={activeTab === 'settings' ? 'auto' : 'none'}
          >
            <SettingsScreen
              isActive={activeTab === 'settings'}
              onUserChanged={() => setUsersRefreshKey((k) => k + 1)}
            />
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
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  pages: { flex: 1, overflow: 'hidden' },
  safeArea: { flex: 1 },
  glowTopLeft: {
    position: 'absolute', top: -60, left: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,122,0,0.08)',
  },
  glowBottomRight: {
    position: 'absolute', bottom: 80, right: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,122,0,0.05)',
  },
  grid: {
    paddingHorizontal: SPACING.xl - SPACING.sm / 2,
    paddingBottom: SPACING.xl,
  },
  row: { justifyContent: 'space-between' },
  navWrapper: { backgroundColor: 'transparent' },
  noCabin: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  noCabinIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.glass,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  noCabinTitle: {
    color: COLORS.text, fontSize: 20, fontWeight: '700',
    letterSpacing: -0.4, marginBottom: SPACING.sm,
  },
  noCabinSubtitle: {
    color: COLORS.textMuted, fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  noCabinHint: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,122,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,122,0,0.2)',
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  noCabinHintText: { color: COLORS.accent, fontSize: 13, fontWeight: '500', marginLeft: SPACING.xs },
});

export default HomeScreen;
