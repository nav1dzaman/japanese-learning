import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { VocabStatus } from '../types';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/colors';

interface StatusToggleProps {
  status: VocabStatus;
  onPress: (next: VocabStatus) => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  unread: {
    label: 'Unread',
    emoji: '📖',
    color: COLORS.unread,
    muted: COLORS.unreadMuted,
    next: 'studying' as VocabStatus,
  },
  studying: {
    label: 'Studying',
    emoji: '✏️',
    color: COLORS.studying,
    muted: COLORS.studyingMuted,
    next: 'studied' as VocabStatus,
  },
  studied: {
    label: 'Studied',
    emoji: '✅',
    color: COLORS.studied,
    muted: COLORS.studiedMuted,
    next: 'unread' as VocabStatus,
  },
};

export function StatusToggle({ status, onPress, compact = false }: StatusToggleProps) {
  const config = STATUS_CONFIG[status];

  return (
    <TouchableOpacity
      onPress={() => onPress(config.next)}
      style={[
        styles.button,
        compact && styles.compact,
        { backgroundColor: config.muted, borderColor: config.color },
      ]}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{config.emoji}</Text>
      {!compact && (
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      )}
    </TouchableOpacity>
  );
}

export function StatusBadge({ status }: { status: VocabStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.muted }]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  compact: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  emoji: {
    fontSize: FONTS.sizes.sm,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
  },
});
