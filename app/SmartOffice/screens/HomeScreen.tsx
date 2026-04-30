import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING } from '../constants/theme';
import { Cabin, INITIAL_CABINS } from '../constants/cabinData';
import Header from '../components/Header';
import CabinCard from '../components/CabinCard';
import BottomNav from '../components/BottomNav';
import MasterControl from '../components/MasterControl';

const { width } = Dimensions.get('window');
const CARD_MARGIN = SPACING.sm / 2;
const NUM_COLUMNS = 2;

type TabName = 'home' | 'devices' | 'automation' | 'settings';

const HomeScreen: React.FC = () => {
  const [cabins, setCabins] = useState<Cabin[]>(INITIAL_CABINS);
  const [activeTab, setActiveTab] = useState<TabName>('home');

  const toggleLight = useCallback((cabinId: string) => {
    setCabins((prev) =>
      prev.map((c) =>
        c.id === cabinId ? { ...c, light: { ...c.light, isOn: !c.light.isOn } } : c
      )
    );
  }, []);

  const toggleFan = useCallback((cabinId: string) => {
    setCabins((prev) =>
      prev.map((c) =>
        c.id === cabinId ? { ...c, fan: { ...c.fan, isOn: !c.fan.isOn } } : c
      )
    );
  }, []);

  const allLightsOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, light: { ...c.light, isOn: true } })));
  }, []);

  const allLightsOff = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, light: { ...c.light, isOn: false } })));
  }, []);

  const allFansOn = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, fan: { ...c.fan, isOn: true } })));
  }, []);

  const allFansOff = useCallback(() => {
    setCabins((prev) => prev.map((c) => ({ ...c, fan: { ...c.fan, isOn: false } })));
  }, []);

  const allOff = useCallback(() => {
    setCabins((prev) =>
      prev.map((c) => ({
        ...c,
        light: { ...c.light, isOn: false },
        fan: { ...c.fan, isOn: false },
      }))
    );
  }, []);

  const activeDevices = cabins.reduce(
    (acc, c) => acc + (c.light.isOn ? 1 : 0) + (c.fan.isOn ? 1 : 0),
    0
  );
  const totalDevices = cabins.length * 2;

  const renderCabin = ({ item }: { item: Cabin }) => (
    <CabinCard
      cabin={item}
      onToggleLight={() => toggleLight(item.id)}
      onToggleFan={() => toggleFan(item.id)}
      onPress={() => {}}
    />
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* Ambient glow blobs */}
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Header activeDevices={activeDevices} totalDevices={totalDevices} />

        <FlatList
          data={cabins}
          renderItem={renderCabin}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <MasterControl
              onAllLightsOn={allLightsOn}
              onAllLightsOff={allLightsOff}
              onAllFansOn={allFansOn}
              onAllFansOff={allFansOff}
              onAllOff={allOff}
            />
          }
        />

        <SafeAreaView edges={['bottom']} style={styles.navWrapper}>
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  glowTopLeft: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,122,0,0.08)',
    // blur simulated via large border radius & opacity
  },
  glowBottomRight: {
    position: 'absolute',
    bottom: 80,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,122,0,0.05)',
  },
  grid: {
    paddingHorizontal: SPACING.xl - SPACING.sm / 2,
    paddingBottom: SPACING.xl,
  },
  row: {
    justifyContent: 'space-between',
  },
  navWrapper: {
    backgroundColor: 'transparent',
  },
});

export default HomeScreen;
