import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export type TabName = 'home' | 'users' | 'analytics' | 'schedules' | 'settings';

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
];

interface BottomNavProps {
  activeTab: TabName;
  isAdmin: boolean;
  onTabChange: (tab: TabName) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, isAdmin, onTabChange }) => {
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onTabChange(tab.name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isActive ? (tab.icon.replace('-outline', '') as keyof typeof Ionicons.glyphMap) : tab.icon}
                size={isActive ? 20 : 18}
                color={isActive ? '#fff' : 'rgba(255,255,255,0.6)'}
              />
              {isActive && <Text style={styles.tabLabel}>{tab.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: COLORS.accent,
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
  },
  tabActive: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  tabLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BottomNav;
