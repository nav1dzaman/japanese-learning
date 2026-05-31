import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Section } from '../types';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/colors';
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
  const progress = totalCount > 0 ? studiedCount / totalCount : 0;
  const unreadCount = totalCount - studiedCount - studyingCount;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.sectionMeta}>
          <Text style={styles.sectionNum}>§ {section.section}</Text>
          <Text style={styles.sectionName}>{section.section_name}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </View>

      <View style={styles.pills}>
        <Pill value={studiedCount} label="Studied" color={COLORS.studied} bg={COLORS.studiedMuted} />
        <Pill value={studyingCount} label="Studying" color={COLORS.studying} bg={COLORS.studyingMuted} />
        <Pill value={unreadCount} label="Unread" color={COLORS.unread} bg={COLORS.unreadMuted} />
        <Pill value={totalCount} label="Total" color={COLORS.primary} bg={COLORS.primaryMuted} />
      </View>

      <ProgressBar
        progress={progress}
        color={COLORS.studied}
        backgroundColor={COLORS.bgElevated}
        height={4}
      />
    </TouchableOpacity>
  );
}

function Pill({ value, label, color, bg }: { value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.primary,
    fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  arrow: {
    fontSize: 28,
    color: COLORS.primary,
    fontWeight: FONTS.weights.light,
  },
  pills: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
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
