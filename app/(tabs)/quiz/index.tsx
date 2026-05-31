import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useVocabStore } from '../../../src/stores/vocabStore';
import { Chapter, VocabStatus } from '../../../src/types';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../../src/constants/colors';

type StatusFilter = 'studying' | 'studied' | 'both';
type QCount = 10 | 20 | 30 | 'all';

const Q_COUNTS: QCount[] = [10, 20, 30, 'all'];

export default function QuizSetupScreen() {
  const { user } = useAuthStore();
  const { statusMap } = useVocabStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('studying');
  const [questionCount, setQuestionCount] = useState<QCount>(10);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChapters();
  }, []);

  // Re-count whenever filter, chapter, or status map changes
  useEffect(() => {
    const statuses: VocabStatus[] =
      statusFilter === 'both' ? ['studying', 'studied'] : [statusFilter];

    const entries = Object.entries(statusMap);
    console.log('[Quiz] statusMap total entries:', entries.length);
    console.log('[Quiz] statusMap sample:', entries.slice(0, 3));

    const filtered = entries.filter(([compositeId, s]) => {
      if (!statuses.includes(s as VocabStatus)) return false;
      if (selectedChapterId) {
        return compositeId.startsWith(`${selectedChapterId}_`);
      }
      return true;
    });
    console.log('[Quiz] filtered count for', statusFilter, ':', filtered.length);
    setAvailableCount(filtered.length);
  }, [statusFilter, selectedChapterId, statusMap]);

  const fetchChapters = async () => {
    const { data } = await supabase
      .from('vocabulary')
      .select('chapter, chapter_name')
      .order('chapter');
    if (!data) return;
    // Deduplicate by chapter number
    const seen = new Set<number>();
    const unique = data.filter((row: { chapter: number }) => {
      if (seen.has(row.chapter)) return false;
      seen.add(row.chapter);
      return true;
    });
    setChapters(unique as any);
  };


  const handleStart = () => {
    if (availableCount < 4) return;

    const params = new URLSearchParams({
      statusFilter,
      questionCount: String(questionCount),
      ...(selectedChapterId ? { chapterId: selectedChapterId } : {}),
    });
    router.push(`/(tabs)/quiz/session?${params.toString()}`);
  };

  const canStart = availableCount >= 4;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Quiz Setup</Text>
          <Text style={styles.subtitle}>Customize your practice session</Text>
        </View>

        {/* Status filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📚 Study Source</Text>
          <View style={styles.optionRow}>
            {(
              [
                { key: 'studying', label: 'Studying', emoji: '✏️' },
                { key: 'studied', label: 'Studied', emoji: '✅' },
                { key: 'both', label: 'Both', emoji: '🎯' },
              ] as { key: StatusFilter; label: string; emoji: string }[]
            ).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.option,
                  statusFilter === opt.key && styles.optionActive,
                ]}
                onPress={() => setStatusFilter(opt.key)}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text
                  style={[
                    styles.optionLabel,
                    statusFilter === opt.key && styles.optionLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Chapter filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🗂️ Filter by Chapter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chapterRow}>
              <TouchableOpacity
                style={[styles.chapterChip, !selectedChapterId && styles.chapterChipActive]}
                onPress={() => setSelectedChapterId(null)}
              >
                <Text style={[styles.chapterChipText, !selectedChapterId && styles.chapterChipTextActive]}>
                  All Chapters
                </Text>
              </TouchableOpacity>
              {chapters.map((ch: any) => (
                <TouchableOpacity
                  key={String(ch.chapter)}
                  style={[styles.chapterChip, selectedChapterId === String(ch.chapter) && styles.chapterChipActive]}
                  onPress={() => setSelectedChapterId(selectedChapterId === String(ch.chapter) ? null : String(ch.chapter))}
                >
                  <Text style={[styles.chapterChipText, selectedChapterId === String(ch.chapter) && styles.chapterChipTextActive]}>
                    Ch.{ch.chapter} {ch.chapter_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Question count */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔢 Number of Questions</Text>
          <View style={styles.optionRow}>
            {Q_COUNTS.map((q) => (
              <TouchableOpacity
                key={String(q)}
                style={[styles.option, questionCount === q && styles.optionActive]}
                onPress={() => setQuestionCount(q)}
              >
                <Text
                  style={[
                    styles.optionNum,
                    questionCount === q && styles.optionLabelActive,
                  ]}
                >
                  {q === 'all' ? 'All' : q}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Available count */}
        <View style={styles.availCard}>
          <Text style={styles.availNum}>{availableCount}</Text>
          <Text style={styles.availText}>words available for this quiz</Text>
          {!canStart && availableCount < 4 && (
            <Text style={styles.warningText}>
              ⚠️ Need at least 4 words to generate MCQ options. Mark more words!
            </Text>
          )}
        </View>

        {/* Start button */}
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={handleStart}
          disabled={!canStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>
            {canStart ? '🚀 Start Quiz' : '❌ Not Enough Words'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  header: { marginBottom: SPACING.xxl },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  optionRow: { flexDirection: 'row', gap: SPACING.md },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  optionActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  optionEmoji: { fontSize: 20 },
  optionNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.textSecondary },
  optionLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  optionLabelActive: { color: COLORS.primary },
  chapterRow: { flexDirection: 'row', gap: SPACING.sm, paddingBottom: SPACING.sm },
  chapterChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chapterChipActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  chapterChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  chapterChipTextActive: { color: COLORS.primary },
  availCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  availNum: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.heavy, color: COLORS.primary },
  availText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  warningText: { fontSize: FONTS.sizes.sm, color: COLORS.studying, marginTop: SPACING.sm, textAlign: 'center' },
  startBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  startBtnDisabled: { backgroundColor: COLORS.bgElevated, opacity: 0.5 },
  startBtnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
});
