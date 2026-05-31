import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Vocabulary, VocabStatus } from '../types';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/colors';

interface VocabCardProps {
  vocab: Vocabulary;
  status: VocabStatus;
  onStatusChange: (status: VocabStatus) => void;
}

const STATUS_CONFIG: Record<
  VocabStatus,
  { emoji: string; label: string; color: string; bg: string; next: VocabStatus }
> = {
  unread: {
    emoji: '📖',
    label: 'Unread',
    color: COLORS.textMuted,
    bg: COLORS.bgElevated,
    next: 'studying',
  },
  studying: {
    emoji: '✏️',
    label: 'Studying',
    color: COLORS.studying,
    bg: COLORS.studyingMuted,
    next: 'studied',
  },
  studied: {
    emoji: '✅',
    label: 'Studied',
    color: COLORS.studied,
    bg: COLORS.studiedMuted,
    next: 'unread',
  },
};

const BORDER_COLORS: Record<VocabStatus, string> = {
  unread: COLORS.border,
  studying: COLORS.studying,
  studied: COLORS.studied,
};

export function VocabCard({ vocab, status, onStatusChange }: VocabCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const cfg = STATUS_CONFIG[status];
  const hasExample = !!(vocab.example_jp || vocab.example_en);

  const handleToggleExpand = () => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded((e) => !e);
  };

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.card, { borderLeftColor: BORDER_COLORS[status] }]}>

      {/* ── Row 1: number + word + status button ── */}
      <View style={styles.topRow}>

        {/* Serial number pill */}
        <View style={styles.numPill}>
          <Text style={styles.numText}>#{vocab.order_number}</Text>
        </View>

        {/* Japanese word + reading */}
        <View style={styles.wordBlock}>
          <Text style={styles.word} numberOfLines={2}>
            {vocab.word}
          </Text>
          <Text style={styles.reading}>{vocab.reading}</Text>
        </View>

        {/* Status button — big, easy to tap */}
        <TouchableOpacity
          style={[styles.statusBtn, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
          onPress={() => onStatusChange(cfg.next)}
          activeOpacity={0.7}
        >
          <Text style={styles.statusEmoji}>{cfg.emoji}</Text>
          <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Row 2: meaning ── */}
      <View style={styles.meaningRow}>
        <Text style={styles.meaning}>{vocab.meaning}</Text>
      </View>

      {/* ── Row 3: expand button (only if examples exist) ── */}
      {hasExample && (
        <TouchableOpacity
          onPress={handleToggleExpand}
          activeOpacity={0.7}
          style={styles.expandBtn}
        >
          <Text style={styles.expandLabel}>例文 (example)</Text>
          <Animated.Text
            style={[styles.chevron, { transform: [{ rotate: chevronRotate }] }]}
          >
            ▼
          </Animated.Text>
        </TouchableOpacity>
      )}

      {/* ── Expanded section ── */}
      {expanded && hasExample && (
        <View style={styles.examples}>
          <View style={styles.exampleDivider} />
          {vocab.example_jp ? (
            <Text style={styles.exampleJp}>{vocab.example_jp}</Text>
          ) : null}
          {vocab.example_en ? (
            <Text style={styles.exampleEn}>{vocab.example_en}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    gap: SPACING.md,
    ...SHADOWS.card,
  },

  /* Top row */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  /* Number pill */
  numPill: {
    minWidth: 36,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  /* Word block */
  wordBlock: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  word: {
    fontSize: 22,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    letterSpacing: 1,
    lineHeight: 28,
  },
  reading: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.medium,
  },

  /* Status button — large tap area */
  statusBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    gap: 3,
    minWidth: 72,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusEmoji: {
    fontSize: 20,
  },
  statusLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.3,
  },

  /* Meaning */
  meaningRow: {},
  meaning: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
    lineHeight: 22,
  },

  /* Expand button */
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
  },
  expandLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
  },
  chevron: {
    fontSize: 9,
    color: COLORS.primary,
  },

  /* Examples */
  examples: {
    gap: SPACING.sm,
  },
  exampleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  exampleJp: {
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    lineHeight: 23,
  },
  exampleEn: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
  },
});
