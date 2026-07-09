import React, { useEffect, useState, useCallback } from 'react';
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
import { COLORS, FONTS, RADIUS, SPACING } from '../../src/constants/colors';
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
      const s = getStatus(v.id);
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
          <Text style={styles.backText}>‹ Home</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.titleEmoji}>動</Text>
          <View>
            <Text style={styles.title}>Verbs</Text>
            <Text style={styles.subtitle}>{verbs.length} verbs total</Text>
          </View>
        </View>

        {/* Status count pills */}
        <View style={styles.countRow}>
          <CountPill label="Unread" value={counts.unread} color={COLORS.unread} />
          <CountPill label="Studying" value={counts.studying} color={COLORS.studying} />
          <CountPill label="Studied" value={counts.studied} color={COLORS.studied} />
        </View>
      </View>

      {/* Search bar — searches meaning column */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by meaning..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
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
      ) : dbError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyText}>Database Error</Text>
          <Text style={styles.emptySubtext}>{dbError}</Text>
          <TouchableOpacity onPress={fetchVerbs} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredVerbs}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.countText}>
              {filteredVerbs.length} verb{filteredVerbs.length !== 1 ? 's' : ''}
              {filter !== 'all' ? ` · ${filter}` : ''}
              {search ? ` · "${search}"` : ''}
            </Text>
          }
          renderItem={({ item }) => (
            <VerbCard
              verb={item}
              status={getStatus(item.id)}
              onStatusChange={(s) => handleStatusChange(item.id, s)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No verbs found</Text>
              <Text style={styles.emptySubtext}>
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
    <View style={[styles.pill, { backgroundColor: `${color}20` }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  backBtn: { marginBottom: SPACING.xs },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  titleEmoji: {
    fontSize: 42,
    color: COLORS.primary,
    fontWeight: FONTS.weights.heavy,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.heavy,
    color: COLORS.text,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
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

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: { fontSize: 16, marginRight: SPACING.xs },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
  },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 13, color: COLORS.textMuted },

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
  filterLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
  },
  filterLabelActive: { color: COLORS.primary },

  /* List */
  countText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    fontWeight: FONTS.weights.medium,
  },
  list: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },

  /* Empty / Error */
  empty: { alignItems: 'center', marginTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 52 },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semibold,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  retryText: {
    color: COLORS.primary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold,
  },
});
