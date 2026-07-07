import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS, ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  highlighted?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, highlighted }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.card, highlighted && styles.highlighted, style]}>
      <View style={styles.innerHighlight} />
      {children}
    </View>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
    position: 'relative',
  },
  highlighted: {
    borderColor: colors.accentGlow,
    backgroundColor: 'rgba(47,128,237,0.07)',
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.glassHighlight,
  },
});

export default GlassCard;
