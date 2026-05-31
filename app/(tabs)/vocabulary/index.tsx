import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useVocabStore } from '../../../src/stores/vocabStore';
import { Chapter, VocabRow } from '../../../src/types';
import { COLORS, FONTS, RADIUS, SPACING, SHADOWS } from '../../../src/constants/colors';

interface ChapterStats {
  chapter: number;
  chapter_name: string;
  totalVocab: number;
  studiedCount: number;
  studyingCount: number;
  sectionCount: number;
}

export default function VocabularyScreen() {
  const { statusMap } = useVocabStore();
  const [chapterStats, setChapterStats] = useState<ChapterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [statusMap]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('vocabulary')
      .select('chapter, chapter_name, section, section_name, no, word_kanji, reading, meaning');

    console.log('[VocabScreen] raw result:', {
      rowCount: data?.length ?? 0,
      firstRow: data?.[0] ?? null,
      error: fetchError?.message ?? null,
    });

    if (fetchError) {
      console.error('[VocabScreen] error:', fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      console.warn('[VocabScreen] table is empty — no rows in vocabulary');
      setChapterStats([]);
      setLoading(false);
      return;
    }

    // Group by chapter number
    const chaptersMap: Record<number, ChapterStats> = {};
    for (const row of data as VocabRow[]) {
      if (!chaptersMap[row.chapter]) {
        chaptersMap[row.chapter] = {
          chapter: row.chapter,
          chapter_name: row.chapter_name,
          totalVocab: 0,
          studiedCount: 0,
          studyingCount: 0,
          sectionCount: 0,
        };
      }
      const stat = chaptersMap[row.chapter];
      stat.totalVocab++;
      const compositeId = `${row.chapter}_${row.section}_${row.no}`;
      const status = statusMap[compositeId];
      if (status === 'studied') stat.studiedCount++;
      if (status === 'studying') stat.studyingCount++;
    }

    // Count unique sections per chapter
    const sectionSets: Record<number, Set<number>> = {};
    for (const row of data as VocabRow[]) {
      if (!sectionSets[row.chapter]) sectionSets[row.chapter] = new Set();
      sectionSets[row.chapter].add(row.section);
    }
    for (const ch of Object.values(chaptersMap)) {
      ch.sectionCount = sectionSets[ch.chapter]?.size ?? 0;
    }

    const sorted = Object.values(chaptersMap).sort((a, b) => a.chapter - b.chapter);
    setChapterStats(sorted);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vocabulary</Text>
        <Text style={styles.subtitle}>Browse by chapter & section</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyText}>Database Error</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={chapterStats}
          keyExtractor={(item) => String(item.chapter)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const progress = item.totalVocab > 0
              ? item.studiedCount / item.totalVocab
              : 0;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/(tabs)/vocabulary/${item.chapter}`)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={styles.chapterBadge}>
                    <Text style={styles.chapterNum}>Ch.{item.chapter}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>{item.chapter_name}</Text>
                    <Text style={styles.cardMeta}>
                      {item.sectionCount} section{item.sectionCount !== 1 ? 's' : ''} · {item.totalVocab} words
                    </Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </View>
                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {item.studiedCount}/{item.totalVocab} studied
                  </Text>
                </View>
                <View style={styles.pillRow}>
                  <View style={[styles.pill, { backgroundColor: COLORS.studyingMuted }]}>
                    <Text style={[styles.pillText, { color: COLORS.studying }]}>✏️ {item.studyingCount}</Text>
                  </View>
                  <View style={[styles.pill, { backgroundColor: COLORS.studiedMuted }]}>
                    <Text style={[styles.pillText, { color: COLORS.studied }]}>✅ {item.studiedCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No vocabulary found</Text>
              <Text style={styles.emptySubtext}>Add data to the vocabulary table in Supabase</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.sm },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  chapterBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  chapterNum: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: FONTS.weights.bold },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  cardMeta: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, marginTop: 2 },
  arrow: { fontSize: 22, color: COLORS.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.studied,
    borderRadius: RADIUS.full,
  },
  progressLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, width: 80, textAlign: 'right' },
  pillRow: { flexDirection: 'row', gap: SPACING.sm },
  pill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  pillText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
  empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
});
