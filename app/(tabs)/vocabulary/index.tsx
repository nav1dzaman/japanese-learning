import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useVocabStore } from '../../../src/stores/vocabStore';
import { Chapter, VocabRow } from '../../../src/types';
import { useColors } from '../../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, SHADOWS, type ThemeColors } from '../../../src/constants/colors';

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
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
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

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setChapterStats([]);
      setLoading(false);
      return;
    }

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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Vocabulary</Text>
        <Text style={s.subtitle}>Browse by chapter & section</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>⚠️</Text>
          <Text style={s.emptyText}>Database Error</Text>
          <Text style={s.emptySubtext}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={chapterStats}
          keyExtractor={(item) => String(item.chapter)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const progress = item.totalVocab > 0
              ? item.studiedCount / item.totalVocab
              : 0;
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push(`/(tabs)/vocabulary/${item.chapter}`)}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={s.chapterBadge}>
                    <Text style={s.chapterNum}>Ch.{item.chapter}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle}>{item.chapter_name}</Text>
                    <Text style={s.cardMeta}>
                      {item.sectionCount} section{item.sectionCount !== 1 ? 's' : ''} · {item.totalVocab} words
                    </Text>
                  </View>
                  <Text style={s.arrow}>›</Text>
                </View>
                <View style={s.progressRow}>
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={s.progressLabel}>
                    {item.studiedCount}/{item.totalVocab} studied
                  </Text>
                </View>
                <View style={s.pillRow}>
                  <View style={[s.pill, { backgroundColor: C.studyingMuted }]}>
                    <Text style={[s.pillText, { color: C.studying }]}>✏️ {item.studyingCount}</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: C.studiedMuted }]}>
                    <Text style={[s.pillText, { color: C.studied }]}>✅ {item.studiedCount}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyText}>No vocabulary found</Text>
              <Text style={s.emptySubtext}>Add data to the vocabulary table in Supabase</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: SPACING.xl, paddingBottom: SPACING.sm },
    title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text },
    subtitle: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      gap: SPACING.md,
      ...SHADOWS.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    chapterBadge: {
      width: 48,
      height: 48,
      borderRadius: RADIUS.md,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.borderActive,
    },
    chapterNum: { fontSize: FONTS.sizes.xs, color: C.primary, fontWeight: FONTS.weights.bold },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: C.text },
    cardMeta: { fontSize: FONTS.sizes.sm, color: C.textMuted, marginTop: 2 },
    arrow: { fontSize: 22, color: C.textMuted },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    progressBg: {
      flex: 1,
      height: 6,
      backgroundColor: C.border,
      borderRadius: RADIUS.full,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: C.studied,
      borderRadius: RADIUS.full,
    },
    progressLabel: { fontSize: FONTS.sizes.xs, color: C.textMuted, width: 80, textAlign: 'right' },
    pillRow: { flexDirection: 'row', gap: SPACING.sm },
    pill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    pillText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold },
    empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md },
    emptyEmoji: { fontSize: 48 },
    emptyText: { fontSize: FONTS.sizes.lg, color: C.textSecondary, fontWeight: FONTS.weights.semibold },
    emptySubtext: { fontSize: FONTS.sizes.sm, color: C.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
  });
}
