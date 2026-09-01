import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVerbStore } from '../../src/stores/verbStore';
import { Verb, VerbStatus } from '../../src/types';
import { useColors } from '../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../../src/constants/colors';
import { VerbCard } from '../../src/components/VerbCard';

type FilterMode = 'all' | 'unread' | 'studying' | 'studied';

const FILTER_OPTIONS: { label: string; value: FilterMode; emoji: string }[] = [
  { label: 'All', value: 'all', emoji: '📋' },
  { label: 'Unread', value: 'unread', emoji: '📖' },
  { label: 'Studying', value: 'studying', emoji: '✏️' },
  { label: 'Studied', value: 'studied', emoji: '✅' },
];

export default function VerbsScreen() {
  const { user } = useAuthStore();
  const { fetchStatuses, updateStatus, getStatus } = useVerbStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [verbs, setVerbs] = useState<Verb[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    fetchVerbs();
    if (user) fetchStatuses(user.id);
  }, []);

  const fetchVerbs = async () => {
    setLoading(true);
    setDbError(null);

    const { data, error } = await supabase
      .from('verb')
      .select('*')
      .order('id');

    if (error) {
      console.error('[VerbsScreen] DB error:', error.message, error.code);
      setDbError(error.message);
      setLoading(false);
      return;
    }

    console.log('[VerbsScreen] fetched', data?.length ?? 0, 'verbs');
    setVerbs((data ?? []) as Verb[]);
    setLoading(false);
  };

  const handleStatusChange = useCallback(
    (verbId: number, newStatus: VerbStatus) => {
      if (!user) return;
      updateStatus(user.id, verbId, newStatus);
    },
    [user, updateStatus]
  );

  const filteredVerbs = verbs.filter((v) => {
    const status = getStatus(v.id);
    const matchesFilter = filter === 'all' || status === filter;
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      (v.meaning ?? '').toLowerCase().includes(q) ||
      (v.meaning_romaji ?? '').toLowerCase().includes(q) ||
      (v.dictionary ?? '').toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const counts = verbs.reduce(
    (acc, v) => {
      const st = getStatus(v.id);
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
          <Text style={s.backText}>‹ Home</Text>
        </TouchableOpacity>

        <View style={s.titleRow}>
          <Text style={s.titleEmoji}>動</Text>
          <View>
            <Text style={s.title}>Verbs</Text>
            <Text style={s.subtitle}>{verbs.length} verbs total</Text>
          </View>
        </View>

        {/* Status count pills */}
        <View style={s.countRow}>
          <CountPill label="Unread" value={counts.unread} color={C.unread} />
          <CountPill label="Studying" value={counts.studying} color={C.studying} />
          <CountPill label="Studied" value={counts.studied} color={C.studied} />
        </View>
      </View>

      {/* Search bar — searches meaning column */}
      <View style={s.searchContainer}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by meaning..."
          placeholderTextColor={C.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
            <Text style={s.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
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
      ) : dbError ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>⚠️</Text>
          <Text style={s.emptyText}>Database Error</Text>
          <Text style={s.emptySubtext}>{dbError}</Text>
          <TouchableOpacity onPress={fetchVerbs} style={s.retryBtn}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredVerbs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={s.countText}>
              {filteredVerbs.length} verb{filteredVerbs.length !== 1 ? 's' : ''}
              {filter !== 'all' ? ` · ${filter}` : ''}
              {search ? ` · "${search}"` : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <VerbCard
              verb={item}
              status={getStatus(item.id)}
              onStatusChange={(st) => handleStatusChange(item.id, st)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔍</Text>
              <Text style={s.emptyText}>No verbs found</Text>
              <Text style={s.emptySubtext}>
                {search ? `No results for "${search}"` : `No ${filter} verbs yet`}
              </Text>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  pillValue: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
  pillLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
});

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
      padding: SPACING.xl,
      paddingBottom: SPACING.md,
      gap: SPACING.sm,
    },
    backBtn: { marginBottom: SPACING.xs },
    backText: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    titleEmoji: {
      fontSize: 42,
      color: C.primary,
      fontWeight: FONTS.weights.heavy,
    },
    title: {
      fontSize: FONTS.sizes.xxl,
      fontWeight: FONTS.weights.heavy,
      color: C.text,
      lineHeight: 30,
    },
    subtitle: {
      fontSize: FONTS.sizes.sm,
      color: C.textSecondary,
      marginTop: 2,
    },
    countRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },

    /* Search */
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.sm,
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: SPACING.md,
    },
    searchIcon: { fontSize: 16, marginRight: SPACING.xs },
    searchInput: {
      flex: 1,
      paddingVertical: SPACING.sm,
      color: C.text,
      fontSize: FONTS.sizes.md,
    },
    clearBtn: { padding: 4 },
    clearBtnText: { fontSize: 13, color: C.textMuted },

    /* Filter tabs */
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
    filterLabel: {
      fontSize: FONTS.sizes.xs,
      color: C.textMuted,
      fontWeight: FONTS.weights.medium,
    },
    filterLabelActive: { color: C.primary },

    /* List */
    countText: {
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      marginBottom: SPACING.sm,
      fontWeight: FONTS.weights.medium,
    },
    list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },

    /* Empty / Error */
    empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
    emptyEmoji: { fontSize: 52 },
    emptyText: {
      fontSize: FONTS.sizes.lg,
      color: C.textSecondary,
      fontWeight: FONTS.weights.semibold,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    retryBtn: {
      marginTop: SPACING.sm,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.xl,
      borderRadius: RADIUS.full,
      backgroundColor: C.primaryMuted,
      borderWidth: 1,
      borderColor: C.primary,
    },
    retryText: {
      color: C.primary,
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.semibold,
    },
  });
}
