import React, { useEffect, useMemo, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SPACING, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import FadeInView from './FadeInView';

export type TabName = 'home' | 'schedules' | 'analytics' | 'users' | 'settings' | 'logs';

interface Tab {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { name: 'home',      icon: 'home-outline',     label: 'Home' },
  { name: 'schedules', icon: 'calendar-outline', label: 'Schedules' },
  { name: 'analytics', icon: 'bar-chart-outline', label: 'Analytics', adminOnly: true },
  { name: 'users',     icon: 'people-outline',   label: 'Users',    adminOnly: true },
  { name: 'settings',  icon: 'settings-outline', label: 'Settings', adminOnly: true },
  { name: 'logs',      icon: 'document-text-outline', label: 'Logs', adminOnly: true },
];

interface NavTabProps {
  tab: Tab;
  isActive: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

const NavTab: React.FC<NavTabProps> = ({ tab, isActive, onPress, styles }) => {
  const progress = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isActive ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  const iconScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.tabBgOverlay, { opacity: progress }]} />
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons
          name={isActive ? (tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap) : tab.icon}
          size={19}
          color={isActive ? '#fff' : 'rgba(255,255,255,0.6)'}
        />
      </Animated.View>
      {isActive && (
        <FadeInView duration={200} distance={0} style={styles.tabLabelWrap}>
          <Text style={styles.tabLabel}>{tab.label}</Text>
        </FadeInView>
      )}
    </TouchableOpacity>
  );
};

interface BottomNavProps {
  activeTab: TabName;
  isAdmin: boolean;
  onTabChange: (tab: TabName) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, isAdmin, onTabChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {visibleTabs.map((tab) => (
          <NavTab
            key={tab.name}
            tab={tab}
            isActive={activeTab === tab.name}
            onPress={() => onTabChange(tab.name)}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: RADIUS.full,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    gap: 6,
    overflow: 'hidden',
  },
  tabBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: RADIUS.full,
  },
  tabLabelWrap: {
    flexDirection: 'row',
  },
  tabLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BottomNav;
