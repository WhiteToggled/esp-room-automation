import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { COLORS } from '../constants/theme';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isOn, onToggle, size = 'md' }) => {
  const translateX = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  const bgOpacity = useRef(new Animated.Value(isOn ? 1 : 0)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  const isSmall = size === 'sm';
  const trackW = isSmall ? 38 : 46;
  const trackH = isSmall ? 22 : 26;
  const thumbSize = isSmall ? 16 : 20;
  const travelDist = trackW - thumbSize - 6;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: isOn ? travelDist : 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
      Animated.timing(bgOpacity, {
        toValue: isOn ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isOn]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(thumbScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(thumbScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const bgColor = bgOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.toggleOff, COLORS.accent],
  });

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.track,
          { width: trackW, height: trackH, borderRadius: trackH / 2, backgroundColor: bgColor },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              top: (trackH - thumbSize) / 2,
              left: 3,
              transform: [{ translateX }, { scale: thumbScale }],
            },
          ]}
        />
        {isOn && (
          <View style={[styles.glowDot, { top: (trackH - thumbSize) / 2, left: 3 }]} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  glowDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default ToggleSwitch;
