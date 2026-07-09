import React, { useEffect, useState, useCallback } from 'react';
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
import { COLORS, FONTS, RADIUS, SPACING } from '../../../../src/constants/colors';
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
      // Persist last visited location for dashboard "Continue" card
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
      const s = getStatus(String(v.id));
      acc[s]++;
      return acc;
    },
    { unread: 0, studying: 0, studied: 0 }
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Sections</Text>
        </TouchableOpacity>
        <Text style={styles.sectionName}>{sectionName || `Section ${sectionNum}`}</Text>
        <View style={styles.countRow}>
          <CountPill label="Unread" value={counts.unread} color={COLORS.unread} />
          <CountPill label="Studying" value={counts.studying} color={COLORS.studying} />
          <CountPill label="Studied" value={counts.studied} color={COLORS.studied} />
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search words..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => setFilter(opt.value)}
            style={[
              styles.filterTab,
              filter === opt.value && styles.filterTabActive,
            ]}
          >
            <Text style={styles.filterEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                styles.filterLabel,
                filter === opt.value && styles.filterLabelActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredVocab}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.countText}>
              {filteredVocab.length} word{filteredVocab.length !== 1 ? 's' : ''}
              {filter !== 'all' ? ` (${filter})` : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <VocabCard
              vocab={item}
              status={getStatus(String(item.id))}
              onStatusChange={(s) => handleStatusChange(String(item.id), s)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No words found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function CountPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md, gap: SPACING.sm },
  backBtn: {},
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
  sectionName: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: COLORS.text },
  countRow: { flexDirection: 'row', gap: SPACING.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  pillValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  pillLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  searchContainer: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },
  searchInput: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 2,
  },
  filterTabActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  filterEmoji: { fontSize: 16 },
  filterLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  filterLabelActive: { color: COLORS.primary },
  countText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontWeight: FONTS.weights.medium,
  },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  empty: { alignItems: 'center', marginTop: 60, gap: SPACING.md },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
});
