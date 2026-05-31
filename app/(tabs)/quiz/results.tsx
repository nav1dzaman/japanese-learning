import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../../src/constants/colors';
import { ProgressBar } from '../../../src/components/ProgressBar';

export default function QuizResultsScreen() {
  const { total, correct, duration } = useLocalSearchParams<{
    total: string;
    correct: string;
    duration: string;
  }>();

  const totalNum = parseInt(total ?? '0');
  const correctNum = parseInt(correct ?? '0');
  const durationNum = parseInt(duration ?? '0');
  const wrong = totalNum - correctNum;
  const percentage = totalNum > 0 ? Math.round((correctNum / totalNum) * 100) : 0;

  const minutes = Math.floor(durationNum / 60);
  const seconds = durationNum % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  const { emoji, message, color } = getResultFeedback(percentage);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Big emoji result */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>{emoji}</Text>
          <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        {/* Score card */}
        <View style={styles.scoreCard}>
          <Text style={styles.cardTitle}>Quiz Summary</Text>

          <ProgressBar progress={percentage / 100} color={color} height={10} />

          <View style={styles.statsGrid}>
            <StatBox label="Correct" value={correctNum} color={COLORS.correct} emoji="✓" />
            <StatBox label="Wrong" value={wrong} color={COLORS.incorrect} emoji="✗" />
            <StatBox label="Total" value={totalNum} color={COLORS.primary} emoji="📝" />
            <StatBox label="Time" value={timeStr as any} color={COLORS.textSecondary} emoji="⏱" />
          </View>
        </View>

        {/* Score breakdown */}
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={[styles.breakdownBar, { backgroundColor: COLORS.correct, flex: correctNum || 1 }]} />
            <View style={[styles.breakdownBar, { backgroundColor: COLORS.incorrect, flex: wrong || 0 }]} />
          </View>
          <View style={styles.breakdownLabels}>
            <Text style={[styles.breakdownLabel, { color: COLORS.correct }]}>{correctNum} Correct</Text>
            <Text style={[styles.breakdownLabel, { color: COLORS.incorrect }]}>{wrong} Wrong</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(tabs)/quiz')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>🔄 Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>🏠 Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(tabs)/vocabulary')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>📚 Study More</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getResultFeedback(pct: number) {
  if (pct >= 90) return { emoji: '🏆', message: 'Outstanding! Perfect score!', color: COLORS.studied };
  if (pct >= 75) return { emoji: '🌟', message: 'Great job! Keep it up!', color: COLORS.studied };
  if (pct >= 60) return { emoji: '👍', message: 'Good work! Keep studying!', color: COLORS.studying };
  if (pct >= 40) return { emoji: '📖', message: 'Keep practicing!', color: COLORS.primary };
  return { emoji: '💪', message: 'Don\'t give up! Review and retry!', color: COLORS.accent };
}

function StatBox({ label, value, color, emoji }: { label: string; value: number | string; color: string; emoji: string }) {
  return (
    <View style={[styles.statBox, { borderColor: `${color}40` }]}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  heroSection: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.md },
  heroEmoji: { fontSize: 64 },
  percentage: { fontSize: 56, fontWeight: FONTS.weights.heavy },
  message: { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, textAlign: 'center' },
  scoreCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.lg,
    ...SHADOWS.card,
  },
  cardTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  statBox: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  statEmoji: { fontSize: 20 },
  statValue: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy },
  statLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  breakdownCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  breakdownRow: { flexDirection: 'row', height: 12, borderRadius: RADIUS.full, overflow: 'hidden', gap: 2 },
  breakdownBar: { borderRadius: RADIUS.full },
  breakdownLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  actions: { gap: SPACING.md },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  primaryBtnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  secondaryBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
});
