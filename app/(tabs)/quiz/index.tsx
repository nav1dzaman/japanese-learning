import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { useVocabStore } from '../../../src/stores/vocabStore';
import { useGeneralWordStore } from '../../../src/stores/generalWordStore';
import { Chapter, VocabStatus } from '../../../src/types';
import { useColors } from '../../../src/hooks/useColors';
import { FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../../../src/constants/colors';

type QuizSource = 'chapters' | 'general';
type StatusFilter = 'studying' | 'studied' | 'both';
type QCount = 10 | 20 | 30 | 'all';

const Q_COUNTS: QCount[] = [10, 20, 30, 'all'];

export default function QuizSetupScreen() {
  const { user } = useAuthStore();
  const { statusMap: vocabStatusMap } = useVocabStore();
  const { words: generalWords, statusMap: generalStatusMap, fetchWords: fetchGW, fetchStatuses: fetchGWStatuses } = useGeneralWordStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [quizSource, setQuizSource] = useState<QuizSource>('chapters');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [generalCategories, setGeneralCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['All']));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('studying');
  const [qCount, setQCount] = useState<QCount>(10);
  const [loading, setLoading] = useState(true);

  // Available vocab count based on current filters
  const [availableCount, setAvailableCount] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    recalcAvailable();
  }, [quizSource, selectedChapters, selectedCategories, statusFilter, vocabStatusMap, generalWords, generalStatusMap]);

  const fetchInitialData = async () => {
    setLoading(true);
    // 1. Chapters
    const { data: chData } = await supabase
      .from('vocabulary')
      .select('chapter, chapter_name');

    if (chData) {
      const cmap = new Map<number, Chapter>();
      chData.forEach((r: any) => {
        if (!cmap.has(r.chapter)) {
          cmap.set(r.chapter, { chapter: r.chapter, chapter_name: r.chapter_name });
        }
      });
      const arr = Array.from(cmap.values()).sort((a, b) => a.chapter - b.chapter);
      setChapters(arr);
      // Select first chapter by default
      if (arr.length > 0) setSelectedChapters(new Set([arr[0].chapter]));
    }

    // 2. General words
    if (user) {
      await fetchGW(user.id);
      await fetchGWStatuses(user.id);
    }

    setLoading(false);
  };

  // Extract categories when generalWords change
  useEffect(() => {
    const cats = new Set<string>();
    generalWords.forEach((w) => {
      if (w.category?.trim()) cats.add(w.category.trim());
    });
    setGeneralCategories(Array.from(cats).sort());
  }, [generalWords]);

  const recalcAvailable = () => {
    if (quizSource === 'chapters') {
      if (selectedChapters.size === 0) {
        setAvailableCount(0);
        return;
      }
      let count = 0;
      for (const [id, status] of Object.entries(vocabStatusMap)) {
        const ch = parseInt(id.split('_')[0], 10);
        if (selectedChapters.has(ch)) {
          if (statusFilter === 'both' && (status === 'studied' || status === 'studying')) {
            count++;
          } else if (status === statusFilter) {
            count++;
          }
        }
      }
      setAvailableCount(count);
    } else {
      // General words
      let count = 0;
      const isAllCat = selectedCategories.has('All');
      generalWords.forEach((w) => {
        const catMatch = isAllCat || selectedCategories.has(w.category || 'General');
        if (!catMatch) return;
        const st = generalStatusMap[w.id] || 'unread';
        if (statusFilter === 'both') {
          if (st === 'studied' || st === 'studying') count++;
        } else if (st === statusFilter) {
          count++;
        }
      });
      setAvailableCount(count);
    }
  };

  const toggleChapter = (ch: number) => {
    const next = new Set(selectedChapters);
    if (next.has(ch)) next.delete(ch);
    else next.add(ch);
    setSelectedChapters(next);
  };

  const toggleCategory = (cat: string) => {
    if (cat === 'All') {
      setSelectedCategories(new Set(['All']));
      return;
    }
    const next = new Set(selectedCategories);
    next.delete('All');
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    if (next.size === 0) next.add('All');
    setSelectedCategories(next);
  };

  const handleStart = () => {
    if (availableCount === 0) return;
    router.push({
      pathname: '/(tabs)/quiz/session',
      params: {
        source: quizSource,
        chapters: Array.from(selectedChapters).join(','),
        categories: Array.from(selectedCategories).join(','),
        status: statusFilter,
        count: qCount.toString(),
      },
    });
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Quiz Setup</Text>
        <Text style={s.subtitle}>Test your knowledge</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Source selector */}
        <Text style={s.sectionTitle}>1. Vocabulary Source</Text>
        <View style={s.sourceRow}>
          <TouchableOpacity
            onPress={() => setQuizSource('chapters')}
            style={[s.sourceBtn, quizSource === 'chapters' && s.sourceBtnActive]}
          >
            <Text style={s.sourceEmoji}>📖</Text>
            <Text style={[s.sourceText, quizSource === 'chapters' && s.sourceTextActive]}>
              Chapter Vocabulary
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setQuizSource('general')}
            style={[s.sourceBtn, quizSource === 'general' && s.sourceBtnActive]}
          >
            <Text style={s.sourceEmoji}>✨</Text>
            <Text style={[s.sourceText, quizSource === 'general' && s.sourceTextActive]}>
              General Words
            </Text>
          </TouchableOpacity>
        </View>

        {/* Chapters / Categories Selection */}
        {quizSource === 'chapters' ? (
          <>
            <Text style={[s.sectionTitle, { marginTop: SPACING.lg }]}>2. Select Chapters</Text>
            {loading ? (
              <ActivityIndicator color={C.primary} style={{ margin: SPACING.lg }} />
            ) : (
              <View style={s.chipGrid}>
                {chapters.map((ch) => {
                  const active = selectedChapters.has(ch.chapter);
                  return (
                    <TouchableOpacity
                      key={ch.chapter}
                      onPress={() => toggleChapter(ch.chapter)}
                      style={[s.chip, active && s.chipActive]}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>
                        Ch.{ch.chapter} {ch.chapter_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={[s.sectionTitle, { marginTop: SPACING.lg }]}>2. Select General Category</Text>
            <View style={s.chipGrid}>
              {['All', ...generalCategories].map((cat) => {
                const active = selectedCategories.has(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => toggleCategory(cat)}
                    style={[s.chip, active && s.chipActive]}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Status pool */}
        <Text style={[s.sectionTitle, { marginTop: SPACING.xl }]}>3. Word Status Pool</Text>
        <View style={s.chipGrid}>
          {(['studying', 'studied', 'both'] as StatusFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setStatusFilter(f)}
              style={[s.chip, statusFilter === f && s.chipActive]}
            >
              <Text style={[s.chipText, statusFilter === f && s.chipTextActive]}>
                {f === 'studying' ? '✏️ Studying only' : f === 'studied' ? '✅ Studied only' : '📚 Both'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Question count */}
        <Text style={[s.sectionTitle, { marginTop: SPACING.xl }]}>4. Number of Questions</Text>
        <View style={s.chipGrid}>
          {Q_COUNTS.map((c) => (
            <TouchableOpacity
              key={c.toString()}
              onPress={() => setQCount(c)}
              style={[s.chip, qCount === c && s.chipActive]}
            >
              <Text style={[s.chipText, qCount === c && s.chipTextActive]}>
                {c === 'all' ? 'All available' : `${c} questions`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Available Questions:</Text>
          <Text style={s.summaryCount}>{availableCount}</Text>
          {availableCount === 0 && (
            <Text style={s.summaryWarning}>
              {quizSource === 'chapters'
                ? 'No words match the selected chapters & status. Mark some words as studying/studied first!'
                : 'No General Words match the selected categories & status. Mark some General Words first!'}
            </Text>
          )}
        </View>

        {/* Start Button */}
        <TouchableOpacity
          onPress={handleStart}
          disabled={availableCount === 0}
          style={[s.startBtn, availableCount === 0 && s.startBtnDisabled]}
        >
          <Text style={s.startBtnText}>Start Quiz</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    header: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
    },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: C.text,
    },
    subtitle: {
      fontSize: 14,
      color: C.textSecondary,
      marginTop: 2,
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: C.textSecondary,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sourceRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    sourceBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      gap: 6,
    },
    sourceBtnActive: {
      borderColor: C.primary,
      backgroundColor: C.primaryMuted,
    },
    sourceEmoji: {
      fontSize: 16,
    },
    sourceText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
    },
    sourceTextActive: {
      color: C.primary,
      fontWeight: '700',
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
    },
    chipActive: {
      borderColor: C.primary,
      backgroundColor: C.primaryMuted,
    },
    chipText: {
      fontSize: 13,
      color: C.textSecondary,
      fontWeight: '500',
    },
    chipTextActive: {
      color: C.primary,
      fontWeight: '600',
    },
    summaryCard: {
      marginTop: SPACING.xl,
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
    },
    summaryLabel: {
      fontSize: 13,
      color: C.textSecondary,
    },
    summaryCount: {
      fontSize: 32,
      fontWeight: '800',
      color: C.primary,
      marginVertical: 4,
    },
    summaryWarning: {
      fontSize: 12,
      color: C.accent,
      textAlign: 'center',
      marginTop: SPACING.xs,
    },
    startBtn: {
      marginTop: SPACING.lg,
      backgroundColor: C.primary,
      paddingVertical: 16,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      ...SHADOWS.card,
    },
    startBtnDisabled: {
      opacity: 0.4,
    },
    startBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
