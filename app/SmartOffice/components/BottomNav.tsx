import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export type TabName = 'home' | 'users' | 'analytics';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const ADMIN_TABS: { name: TabName; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'home', icon: 'home-outline', label: 'Home' },
  { name: 'analytics', icon: 'bar-chart-outline', label: 'Analytics' },
  { name: 'users', icon: 'people-outline', label: 'Users' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = ADMIN_TABS;

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => onTabChange(tab.name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isActive ? (tab.icon.replace('-outline', '') as any) : tab.icon}
                size={isActive ? 20 : 18}
                color={isActive ? '#fff' : COLORS.textMuted}
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
    position: 'relative',
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
