import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthStore } from '../../../../src/stores/authStore';
import { useVocabStore, rowToVocab } from '../../../../src/stores/vocabStore';
import { useNavigationStore } from '../../../../src/stores/navigationStore';
import { Vocabulary, VocabRow, VocabStatus } from '../../../../src/types';
import { useColors } from '../../../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../../../src/constants/colors';
import { VocabCard } from '../../../../src/components/VocabCard';

type FilterMode = 'all' | 'unread' | 'studying' | 'studied';

const FILTER_OPTIONS: { label: string; value: FilterMode; emoji: string }[] = [
  { label: 'All', value: 'all', emoji: '📋' },
  { label: 'Unread', value: 'unread', emoji: '📖' },
  { label: 'Studying', value: 'studying', emoji: '✏️' },
  { label: 'Studied', value: 'studied', emoji: '✅' },
];

export default function SectionDetailScreen() {
  const { chapterId, sectionId } = useLocalSearchParams<{ chapterId: string; sectionId: string }>();
  const chapterNum = parseInt(chapterId, 10);
  const sectionNum = parseInt(sectionId, 10);

  const { user } = useAuthStore();
  const { saveLocation } = useNavigationStore();
  const { statusMap, updateStatus, getStatus } = useVocabStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [sectionName, setSectionName] = useState('');
  const [vocab, setVocab] = useState<Vocabulary[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [chapterId, sectionId]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('chapter', chapterNum)
      .eq('section', sectionNum)
      .order('no');

    if (error) {
      console.error('[SectionScreen] error:', error.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const firstRow = data[0] as VocabRow;
      setSectionName(firstRow.section_name);
      setVocab((data as VocabRow[]).map(rowToVocab));
      saveLocation({
        type: 'section',
        chapterId: chapterNum,
        chapterName: firstRow.chapter_name,
        sectionId: sectionNum,
        sectionName: firstRow.section_name,
      });
    }
    setLoading(false);
  };

  const handleStatusChange = useCallback(
    (vocabId: string, newStatus: VocabStatus) => {
      if (!user) return;
      updateStatus(user.id, vocabId, newStatus);
    },
    [user, updateStatus]
  );

  const filteredVocab = vocab.filter((v) => {
    const status = getStatus(String(v.id));
    const matchesFilter = filter === 'all' || status === filter;
    const matchesSearch =
      !search ||
      v.word.includes(search) ||
      v.reading.includes(search) ||
      v.meaning.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = vocab.reduce(
    (acc, v) => {
      const st = getStatus(String(v.id));
      acc[st]++;
      return acc;
    },
    { unread: 0, studying: 0, studied: 0 }
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Sections</Text>
        </TouchableOpacity>
        <Text style={s.sectionName}>{sectionName || `Section ${sectionNum}`}</Text>
        <View style={s.countRow}>
          <CountPill label="Unread" value={counts.unread} color={C.unread} />
          <CountPill label="Studying" value={counts.studying} color={C.studying} />
          <CountPill label="Studied" value={counts.studied} color={C.studied} />
        </View>
      </View>

      {/* Search */}
      <View style={s.searchContainer}>
        <TextInput
          style={s.searchInput}
          placeholder="Search words..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setFilter(opt.value)}
            style={[
              s.filterTab,
              filter === opt.value && s.filterTabActive,
            ]}
          >
            <Text style={s.filterEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                s.filterLabel,
                filter === opt.value && s.filterLabelActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredVocab}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.countText}>
              {filteredVocab.length} word{filteredVocab.length !== 1 ? 's' : ''}
              {filter !== 'all' ? ` (${filter})` : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <VocabCard
              vocab={item}
              status={getStatus(String(item.id))}
              onStatusChange={(st) => handleStatusChange(String(item.id), st)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyText}>No words found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function CountPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[staticStyles.pill, { backgroundColor: `${color}20` }]}>
      <Text style={[staticStyles.pillValue, { color }]}>{value}</Text>
      <Text style={[staticStyles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const staticStyles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  pillValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  pillLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
});

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: { padding: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
    backBtn: {},
    backText: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
    sectionName: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text },
    countRow: { flexDirection: 'row', gap: SPACING.sm },
    searchContainer: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
    searchInput: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      color: C.text,
      fontSize: FONTS.sizes.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.xl,
      gap: SPACING.sm,
      marginBottom: SPACING.md,
    },
    filterTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
      gap: 2,
    },
    filterTabActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    filterEmoji: { fontSize: 16 },
    filterLabel: { fontSize: FONTS.sizes.xs, color: C.textMuted, fontWeight: FONTS.weights.medium },
    filterLabelActive: { color: C.primary },
    countText: {
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      marginBottom: SPACING.sm,
      fontWeight: FONTS.weights.medium,
    },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    empty: { alignItems: 'center', marginTop: 60, gap: SPACING.md },
    emptyEmoji: { fontSize: 40 },
    emptyText: { fontSize: FONTS.sizes.md, color: C.textSecondary },
  });
}
