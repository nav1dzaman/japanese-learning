import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVocabStore } from '../../src/stores/vocabStore';
import { Vocabulary, VocabStatus } from '../../src/types';
import { useColors } from '../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/constants/colors';
import { VocabCard } from '../../src/components/VocabCard';

type TabMode = 'studied' | 'studying';

export default function StudiedScreen() {
  const { user } = useAuthStore();
  const { statusMap, getStatus, updateStatus } = useVocabStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>My Words</Text>
        <Text style={s.subtitle}>Words you're tracking</Text>
      </View>

      {/* Tab switcher */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'studied' && s.tabActive]}
          onPress={() => setTab('studied')}
        >
          <Text style={s.tabEmoji}>✅</Text>
          <Text style={[s.tabLabel, tab === 'studied' && s.tabLabelActive]}>
            Studied
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'studying' && s.tabActiveAmber]}
          onPress={() => setTab('studying')}
        >
          <Text style={s.tabEmoji}>✏️</Text>
          <Text style={[s.tabLabel, tab === 'studying' && s.tabLabelAmber]}>
            Studying
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={s.countText}>{tabCount} word{tabCount !== 1 ? 's' : ''}</Text>

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={vocab}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <VocabCard
              vocab={item}
              status={getStatus(String(item.id))}
              onStatusChange={(st) => handleStatusChange(String(item.id), st)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>{tab === 'studied' ? '📚' : '✏️'}</Text>
              <Text style={s.emptyText}>
                No {tab === 'studied' ? 'studied' : 'studying'} words yet
              </Text>
              <Text style={s.emptySubtext}>
                Browse vocabulary and tap the status button on each card
              </Text>
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
    title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text },
    subtitle: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
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
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
    },
    tabActive: { backgroundColor: C.studiedMuted, borderColor: C.studied },
    tabActiveAmber: { backgroundColor: C.studyingMuted, borderColor: C.studying },
    tabEmoji: { fontSize: 18 },
    tabLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: C.textSecondary },
    tabLabelActive: { color: C.studied },
    tabLabelAmber: { color: C.studying },
    countText: {
      paddingHorizontal: SPACING.xl,
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      marginBottom: SPACING.sm,
      fontWeight: FONTS.weights.medium,
    },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
    empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyEmoji: { fontSize: 52 },
    emptyText: { fontSize: FONTS.sizes.lg, color: C.textSecondary, fontWeight: FONTS.weights.semibold, textAlign: 'center' },
    emptySubtext: { fontSize: FONTS.sizes.sm, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  });
}
