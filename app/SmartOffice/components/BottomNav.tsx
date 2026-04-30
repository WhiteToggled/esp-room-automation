import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

type TabName = 'home' | 'devices' | 'automation' | 'settings';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

const tabs: { name: TabName; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { name: 'home', icon: 'home-outline', label: 'Home' },
  { name: 'devices', icon: 'hardware-chip-outline', label: 'Devices' },
  { name: 'automation', icon: 'flash-outline', label: 'Auto' },
  { name: 'settings', icon: 'settings-outline', label: 'Settings' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
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

        {/* FAB */}
        <TouchableOpacity style={styles.fab} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
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
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    marginLeft: SPACING.xs,
  },
});

export default BottomNav;
