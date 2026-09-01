import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Chapter } from '../types';
import { useColors } from '../hooks/useColors';
import { FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../constants/colors';
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
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const progress = totalVocab > 0 ? studiedCount / totalVocab : 0;
  const icon = CHAPTER_ICONS[(chapter.chapter - 1) % CHAPTER_ICONS.length];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.card}>
      {/* Top row */}
      <View style={s.topRow}>
        <View style={s.iconContainer}>
          <Text style={s.icon}>{icon}</Text>
        </View>
        <View style={s.chapterInfo}>
          <Text style={s.chapterNum}>Chapter {chapter.chapter}</Text>
          <Text style={s.jpName}>{chapter.chapter_name}</Text>
        </View>
        <View style={s.arrow}>
          <Text style={s.arrowText}>›</Text>
        </View>
      </View>

      {/* Name */}
      <Text style={s.enName}>{chapter.chapter_name}</Text>

      {/* Stats row */}
      <View style={s.statsRow}>
        <Stat label="Sections" value={sectionCount} color={C.primary} />
        <Stat label="Total" value={totalVocab} color={C.textSecondary} />
        <Stat label="Studying" value={studyingCount} color={C.studying} />
        <Stat label="Done" value={studiedCount} color={C.studied} />
      </View>

      {/* Progress bar */}
      <View style={s.progressContainer}>
        <ProgressBar progress={progress} color={C.studied} height={5} />
        <Text style={s.progressText}>
          {totalVocab > 0 ? Math.round(progress * 100) : 0}% complete
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={staticStyles.stat}>
      <Text style={[staticStyles.statValue, { color }]}>{value}</Text>
      <Text style={staticStyles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
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
      backgroundColor: C.primaryMuted,
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
      color: C.primary,
      fontWeight: FONTS.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    jpName: {
      fontSize: FONTS.sizes.xl,
      fontWeight: FONTS.weights.bold,
      color: C.text,
      letterSpacing: 1,
    },
    arrow: {
      paddingLeft: SPACING.sm,
    },
    arrowText: {
      fontSize: 28,
      color: C.primary,
      fontWeight: FONTS.weights.light,
    },
    enName: {
      fontSize: FONTS.sizes.sm,
      color: C.textSecondary,
      marginBottom: SPACING.lg,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    progressContainer: {
      gap: SPACING.xs,
    },
    progressText: {
      fontSize: FONTS.sizes.xs,
      color: C.textMuted,
      textAlign: 'right',
    },
  });
}

const staticStyles = StyleSheet.create({
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: '#9B97B8', // Will be overridden by inline if needed
    marginTop: 2,
  },
});
