import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../../src/hooks/useColors';
import { FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../../../src/constants/colors';
import { ProgressBar } from '../../../src/components/ProgressBar';

export default function QuizResultsScreen() {
  const { total, correct, duration } = useLocalSearchParams<{
    total: string;
    correct: string;
    duration: string;
  }>();

  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const totalNum = parseInt(total ?? '0');
  const correctNum = parseInt(correct ?? '0');
  const durationNum = parseInt(duration ?? '0');
  const wrong = totalNum - correctNum;
  const percentage = totalNum > 0 ? Math.round((correctNum / totalNum) * 100) : 0;

  let emoji = '😐';
  let message = 'Keep practicing!';
  if (percentage === 100) { emoji = '🎉'; message = 'Perfect score!'; }
  else if (percentage >= 80) { emoji = '🔥'; message = 'Great job!'; }
  else if (percentage >= 50) { emoji = '👍'; message = 'Not bad!'; }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        
        <View style={s.header}>
          <Text style={s.emoji}>{emoji}</Text>
          <Text style={s.message}>{message}</Text>
          <Text style={s.scoreText}>You got {correctNum} out of {totalNum}</Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Performance</Text>
          <View style={s.progressWrap}>
            <ProgressBar progress={percentage / 100} color={C.studied} height={12} />
            <Text style={s.percentText}>{percentage}%</Text>
          </View>
          
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: C.studied }]}>{correctNum}</Text>
              <Text style={s.statLabel}>Correct</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: '#FF4D4D' }]}>{wrong}</Text>
              <Text style={s.statLabel}>Incorrect</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: C.text }]}>{durationNum}s</Text>
              <Text style={s.statLabel}>Time</Text>
            </View>
          </View>
        </View>

        <View style={s.actions}>
          <TouchableOpacity 
            style={s.btnPrimary} 
            onPress={() => router.replace('/(tabs)/quiz')}
          >
            <Text style={s.btnPrimaryText}>Quiz Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={s.btnSecondary} 
            onPress={() => router.navigate('/(tabs)')}
          >
            <Text style={s.btnSecondaryText}>Back to Home</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: SPACING.xl, alignItems: 'center' },
    header: { alignItems: 'center', marginTop: SPACING.xxl, marginBottom: SPACING.xxl },
    emoji: { fontSize: 72, marginBottom: SPACING.md },
    message: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text, marginBottom: SPACING.xs },
    scoreText: { fontSize: FONTS.sizes.md, color: C.textSecondary },
    card: {
      width: '100%',
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: SPACING.xxxl,
      ...SHADOWS.card,
    },
    cardTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: C.text, marginBottom: SPACING.lg },
    progressWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl },
    percentText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: C.studied, width: 45, textAlign: 'right' },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md },
    statBox: { alignItems: 'center', flex: 1 },
    statNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.heavy, marginBottom: 2 },
    statLabel: { fontSize: FONTS.sizes.xs, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    statDivider: { width: 1, height: 30, backgroundColor: C.border },
    actions: { width: '100%', gap: SPACING.md },
    btnPrimary: {
      backgroundColor: C.primary,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      ...SHADOWS.card,
    },
    btnPrimaryText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
    btnSecondary: {
      backgroundColor: C.bgCard,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    btnSecondaryText: { color: C.text, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
  });
}
