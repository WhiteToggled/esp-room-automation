import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  highlighted?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, highlighted }) => {
  return (
    <View style={[styles.card, highlighted && styles.highlighted, style]}>
      <View style={styles.innerHighlight} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  highlighted: {
    borderColor: COLORS.accentGlow,
    backgroundColor: 'rgba(255,122,0,0.07)',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: COLORS.glassHighlight,
  },
});

export default GlassCard;
