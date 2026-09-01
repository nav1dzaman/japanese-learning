import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RADIUS } from '../constants/colors';

interface ProgressBarProps {
  progress: number; // 0–1
  color?: string;
  backgroundColor?: string;
  height?: number;
}

export function ProgressBar({
  progress,
  color = '#7C6AF7',
  backgroundColor = '#1E1E36',
  height = 6,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.container, { backgroundColor, height, borderRadius: RADIUS.full }]}>
      <View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: `${clampedProgress * 100}%`,
            height,
            borderRadius: RADIUS.full,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
