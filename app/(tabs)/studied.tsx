import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVocabStore } from '../../src/stores/vocabStore';
import { Vocabulary, VocabStatus } from '../../src/types';
import { COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/colors';
import { VocabCard } from '../../src/components/VocabCard';

type TabMode = 'studied' | 'studying';

export default function StudiedScreen() {
  const { user } = useAuthStore();
  const { statusMap, getStatus, updateStatus } = useVocabStore();
  const [tab, setTab] = useState<TabMode>('studied');
  const [vocab, setVocab] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVocab();
  }, [tab, statusMap, user]);

  const fetchVocab = async () => {
    if (!user) return;
    setLoading(true);

    // Get all vocab IDs with given status for this user from statusMap
    const { statusMap: currentStatusMap } = useVocabStore.getState();
    const matchingIds = Object.entries(currentStatusMap)
      .filter(([, s]) => s === tab)
      .map(([id]) => id);

    if (matchingIds.length === 0) {
      setVocab([]);
      setLoading(false);
      return;
    }

    // Fetch all vocab and filter locally using composite keys
    const { data: allData } = await supabase
      .from('vocabulary')
      .select('chapter, chapter_name, section, section_name, no, word_kanji, reading, meaning, jp_example, en_example')
      .order('chapter');

    const { rowToVocab } = await import('../../src/stores/vocabStore');
    const matchSet = new Set(matchingIds);
    const filtered = (allData ?? [])
      .map((r: any) => rowToVocab(r))
      .filter((v: any) => matchSet.has(v.id));

    setVocab(filtered);
    setLoading(false);
  };

  const handleStatusChange = (vocabId: string, newStatus: VocabStatus) => {
    if (!user) return;
    updateStatus(user.id, vocabId, newStatus);
  };

  const tabCount = vocab.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Words</Text>
        <Text style={styles.subtitle}>Words you're tracking</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'studied' && styles.tabActive]}
          onPress={() => setTab('studied')}
        >
          <Text style={styles.tabEmoji}>✅</Text>
          <Text style={[styles.tabLabel, tab === 'studied' && styles.tabLabelActive]}>
            Studied
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'studying' && styles.tabActiveAmber]}
          onPress={() => setTab('studying')}
        >
          <Text style={styles.tabEmoji}>✏️</Text>
          <Text style={[styles.tabLabel, tab === 'studying' && styles.tabLabelAmber]}>
            Studying
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>{tabCount} word{tabCount !== 1 ? 's' : ''}</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={vocab}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <VocabCard
              vocab={item}
              status={getStatus(String(item.id))}
              onStatusChange={(s) => handleStatusChange(String(item.id), s)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tab === 'studied' ? '📚' : '✏️'}</Text>
              <Text style={styles.emptyText}>
                No {tab === 'studied' ? 'studied' : 'studying'} words yet
              </Text>
              <Text style={styles.emptySubtext}>
                Browse vocabulary and tap the status button on each card
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.studiedMuted, borderColor: COLORS.studied },
  tabActiveAmber: { backgroundColor: COLORS.studyingMuted, borderColor: COLORS.studying },
  tabEmoji: { fontSize: 18 },
  tabLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.studied },
  tabLabelAmber: { color: COLORS.studying },
  countText: {
    paddingHorizontal: SPACING.xl,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontWeight: FONTS.weights.medium,
  },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 52 },
  emptyText: { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold, textAlign: 'center' },
  emptySubtext: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});
