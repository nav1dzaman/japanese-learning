import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Section } from '../types';
import { useColors } from '../hooks/useColors';
import { FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../constants/colors';
import { ProgressBar } from './ProgressBar';

interface SectionCardProps {
  section: Section;
  totalCount: number;
  studiedCount: number;
  studyingCount: number;
  onPress: () => void;
}

export function SectionCard({
  section,
  totalCount,
  studiedCount,
  studyingCount,
  onPress,
}: SectionCardProps) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const progress = totalCount > 0 ? studiedCount / totalCount : 0;
  const unreadCount = totalCount - studiedCount - studyingCount;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.card}>
      <View style={s.header}>
        <View style={s.sectionMeta}>
          <Text style={s.sectionNum}>§ {section.section}</Text>
          <Text style={s.sectionName}>{section.section_name}</Text>
        </View>
        <Text style={s.arrow}>›</Text>
      </View>

      <View style={s.pills}>
        <Pill value={studiedCount} label="Studied" color={C.studied} bg={C.studiedMuted} />
        <Pill value={studyingCount} label="Studying" color={C.studying} bg={C.studyingMuted} />
        <Pill value={unreadCount} label="Unread" color={C.unread} bg={C.unreadMuted} />
        <Pill value={totalCount} label="Total" color={C.primary} bg={C.primaryMuted} />
      </View>

      <ProgressBar
        progress={progress}
        color={C.studied}
        backgroundColor={C.bgElevated}
        height={4}
      />
    </TouchableOpacity>
  );
}

function Pill({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[staticStyles.pill, { backgroundColor: bg }]}>
      <Text style={[staticStyles.pillValue, { color }]}>{value}</Text>
      <Text style={[staticStyles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      gap: SPACING.md,
      ...SHADOWS.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    sectionMeta: {
      flex: 1,
      gap: 2,
    },
    sectionNum: {
      fontSize: FONTS.sizes.xs,
      color: C.primary,
      fontWeight: FONTS.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionName: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.bold,
      color: C.text,
    },
    arrow: {
      fontSize: 28,
      color: C.primary,
      fontWeight: FONTS.weights.light,
    },
    pills: {
      flexDirection: 'row',
      gap: SPACING.xs,
      flexWrap: 'wrap',
    },
  });
}

const staticStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pillValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
  },
  pillLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.medium,
    opacity: 0.85,
  },
});
