import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  Dimensions,
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
import AnalyticsScreen from './AnalyticsScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 2;

const TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };

const HomeScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [cabins, setCabins] = useState<Cabin[]>(INITIAL_CABINS);
  const [activeTab, setActiveTab] = useState<TabName>('home');

  const isAdmin = user?.role === 'admin';

  // 0 = home visible, 1 = analytics, 2 = users
  const offset = useSharedValue(0);
  const TAB_INDEX = useMemo<Record<TabName, number>>(
    () => ({ home: 0, analytics: 1, users: 2 }),
    []
  );

  useEffect(() => {
    offset.value = withTiming(TAB_INDEX[activeTab], TIMING);
  }, [activeTab, TAB_INDEX, offset]);

  const homeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * -SCREEN_WIDTH }],
  }));

  const analyticsAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - offset.value) * SCREEN_WIDTH }],
  }));

  const usersAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (2 - offset.value) * SCREEN_WIDTH }],
  }));

  const visibleCabins = useMemo(
    () => (isAdmin ? cabins : cabins.filter((c) => c.id === user?.assignedCabinId)),
    [cabins, isAdmin, user?.assignedCabinId]
  );

  const toggleLight = useCallback((cabinId: string) => {
    // Optimistic UI update and backend toggle when a mapping exists
    setCabins((prev) =>
      prev.map((c) =>
        c.id === cabinId ? { ...c, light: { ...c.light, isOn: !c.light.isOn } } : c
      )
    );
    const cabin = cabins.find((c) => c.id === cabinId);
    const topic = cabin?.light.topic;
    if (topic) {
      devicesApi.toggle(topic).catch(async () => {
        // On error, refresh states from server to reconcile
        try {
          const states = await devicesApi.getStates();
          reconcileStates(states);
        } catch (_) {
          // ignore
        }
      });
    }
  }, []);

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
  }, []);

  const allLightsOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, light: { ...c.light, isOn: true } })));
    // Backend toggle-all should be called via MasterControl (admin) — but we attempt to reconcile
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const allLightsOff = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, light: { ...c.light, isOn: false } })));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const allFansOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, fan: { ...c.fan, isOn: true } })));
    devicesApi.getStates().then(reconcileStates).catch(() => {});
  }, []);

  const allFansOff = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, fan: { ...c.fan, isOn: false } })));
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

  // Reconcile device states from backend -> update cabins where topics match
  const reconcileStates = useCallback((states: Record<string, number>) => {
    setCabins((prev) =>
      prev.map((c) => ({
        ...c,
        light: { ...c.light, isOn: c.light.topic ? Boolean(states[c.light.topic]) : c.light.isOn },
        fan: { ...c.fan, isOn: c.fan.topic ? Boolean(states[c.fan.topic]) : c.fan.isOn },
      }))
    );
  }, []);

  // Fetch states on mount
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

      {/* Sliding content area */}
      <View style={styles.pages}>

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
                      onAllLightsOff={allLightsOff}
                      onAllFansOn={allFansOn}
                      onAllFansOff={allFansOff}
                      onAllOff={allOff}
                    />
                  ) : null
                }
              />
            )}
          </SafeAreaView>
        </Animated.View>

        {/* Users tab (admin only) */}
        {isAdmin && (
          <Animated.View
            style={[StyleSheet.absoluteFill, usersAnimStyle]}
            pointerEvents={activeTab === 'users' ? 'auto' : 'none'}
          >
            <AdminUsersScreen />
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

      {/* Bottom nav — admin only, always on top */}
      {isAdmin && (
        <SafeAreaView edges={['bottom']} style={styles.navWrapper}>
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </SafeAreaView>
      )}
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
