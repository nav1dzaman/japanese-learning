import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../src/lib/supabase';
import { useVocabStore } from '../../../../src/stores/vocabStore';
import { VocabRow } from '../../../../src/types';
import { useColors } from '../../../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, SHADOWS, type ThemeColors } from '../../../../src/constants/colors';

interface SectionStats {
  section: number;
  section_name: string;
  total: number;
  studied: number;
  studying: number;
}

export default function ChapterDetailScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const chapterNum = parseInt(chapterId, 10);
  const { statusMap } = useVocabStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const [chapterName, setChapterName] = useState('');
  const [sections, setSections] = useState<SectionStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [chapterId, statusMap]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vocabulary')
      .select('chapter, chapter_name, section, section_name, no')
      .eq('chapter', chapterNum);

    if (error || !data) {
      setLoading(false);
      return;
    }

    if (data.length > 0) {
      setChapterName((data[0] as VocabRow).chapter_name);
    }

    const sectionMap: Record<number, SectionStats> = {};
    for (const row of data as VocabRow[]) {
      if (!sectionMap[row.section]) {
        sectionMap[row.section] = {
          section: row.section,
          section_name: row.section_name,
          total: 0,
          studied: 0,
          studying: 0,
        };
      }
      const stat = sectionMap[row.section];
      stat.total++;
      const compositeId = `${row.chapter}_${row.section}_${row.no}`;
      const status = statusMap[compositeId];
      if (status === 'studied') stat.studied++;
      if (status === 'studying') stat.studying++;
    }

    const sorted = Object.values(sectionMap).sort((a, b) => a.section - b.section);
    setSections(sorted);
    setLoading(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Chapters</Text>
        </TouchableOpacity>
        <Text style={s.chapterLabel}>Chapter {chapterNum}</Text>
        <Text style={s.chapterName}>{chapterName}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => String(item.section)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.sectionLabel}>
              {sections.length} Section{sections.length !== 1 ? 's' : ''}
            </Text>
          }
          renderItem={({ item }) => {
            const progress = item.total > 0 ? item.studied / item.total : 0;
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push(`/(tabs)/vocabulary/${chapterNum}/${item.section}`)}
                activeOpacity={0.85}
              >
                <View style={s.cardTop}>
                  <View style={s.secBadge}>
                    <Text style={s.secNum}>§{item.section}</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle}>{item.section_name}</Text>
                    <Text style={s.cardMeta}>{item.total} words</Text>
                  </View>
                  <Text style={s.arrow}>›</Text>
                </View>
                <View style={s.progressRow}>
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                  <Text style={s.progressLabel}>{item.studied}/{item.total}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>📭</Text>
              <Text style={s.emptyText}>No sections found</Text>
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
    header: { padding: SPACING.xl, paddingBottom: SPACING.md },
    backBtn: { marginBottom: SPACING.md },
    backText: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
    chapterLabel: { fontSize: FONTS.sizes.sm, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    chapterName: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text, marginTop: 2 },
    sectionLabel: {
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      marginBottom: SPACING.md,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: FONTS.weights.semibold,
    },
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
    secBadge: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.borderActive,
    },
    secNum: { fontSize: FONTS.sizes.xs, color: C.primary, fontWeight: FONTS.weights.bold },
    cardInfo: { flex: 1 },
    cardTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: C.text },
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
    progressLabel: { fontSize: FONTS.sizes.xs, color: C.textMuted, width: 40, textAlign: 'right' },
    empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md },
    emptyEmoji: { fontSize: 48 },
    emptyText: { fontSize: FONTS.sizes.lg, color: C.textSecondary, fontWeight: FONTS.weights.semibold },
  });
}
