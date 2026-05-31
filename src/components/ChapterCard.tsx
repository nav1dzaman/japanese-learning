import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Chapter } from '../types';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/colors';
import { ProgressBar } from './ProgressBar';

interface ChapterCardProps {
  chapter: Chapter;
  totalVocab: number;
  studiedCount: number;
  studyingCount: number;
  sectionCount: number;
  onPress: () => void;
}

const CHAPTER_ICONS = ['🏠', '💼', '🚆', '🍜', '💊', '🎓', '🌸', '💬', '📰', '🌍'];

export function ChapterCard({
  chapter,
  totalVocab,
  studiedCount,
  studyingCount,
  sectionCount,
  onPress,
}: ChapterCardProps) {
  const progress = totalVocab > 0 ? studiedCount / totalVocab : 0;
  const icon = CHAPTER_ICONS[(chapter.chapter - 1) % CHAPTER_ICONS.length];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.chapterInfo}>
          <Text style={styles.chapterNum}>Chapter {chapter.chapter}</Text>
          <Text style={styles.jpName}>{chapter.chapter_name}</Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>›</Text>
        </View>
      </View>

      {/* Name */}
      <Text style={styles.enName}>{chapter.chapter_name}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="Sections" value={sectionCount} color={COLORS.primary} />
        <Stat label="Total" value={totalVocab} color={COLORS.textSecondary} />
        <Stat label="Studying" value={studyingCount} color={COLORS.studying} />
        <Stat label="Done" value={studiedCount} color={COLORS.studied} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <ProgressBar progress={progress} color={COLORS.studied} height={5} />
        <Text style={styles.progressText}>
          {totalVocab > 0 ? Math.round(progress * 100) : 0}% complete
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  icon: {
    fontSize: 24,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterNum: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  jpName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    letterSpacing: 1,
  },
  arrow: {
    paddingLeft: SPACING.sm,
  },
  arrowText: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: FONTS.weights.light,
  },
  enName: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressContainer: {
    gap: SPACING.xs,
  },
  progressText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
});
