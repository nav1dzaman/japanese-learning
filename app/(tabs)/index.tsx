import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVocabStore } from '../../src/stores/vocabStore';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../src/constants/colors';
import { ProgressBar } from '../../src/components/ProgressBar';

interface OverallStats {
  totalVocab: number;
  studiedCount: number;
  studyingCount: number;
  unreadCount: number;
  quizCount: number;
  avgScore: number;
}

export default function HomeScreen() {
  const { user, signOut } = useAuthStore();
  const { statusMap } = useVocabStore();
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    // Count all vocab
    const { count: totalVocab } = await supabase
      .from('vocabulary')
      .select('*', { count: 'exact', head: true });

    // Count statuses for this user
    const { data: statusData } = await supabase
      .from('user_vocab_status')
      .select('status')
      .eq('user_id', user.id);

    const studiedCount = statusData?.filter((r) => r.status === 'studied').length ?? 0;
    const studyingCount = statusData?.filter((r) => r.status === 'studying').length ?? 0;
    const unreadCount = (totalVocab ?? 0) - studiedCount - studyingCount;

    // Quiz stats
    const { data: quizData } = await supabase
      .from('quiz_sessions')
      .select('total_questions, correct_answers, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(5);

    const avgScore =
      quizData && quizData.length > 0
        ? quizData.reduce((sum, q) => sum + (q.correct_answers / q.total_questions) * 100, 0) /
          quizData.length
        : 0;

    setStats({
      totalVocab: totalVocab ?? 0,
      studiedCount,
      studyingCount,
      unreadCount,
      quizCount: quizData?.length ?? 0,
      avgScore: Math.round(avgScore),
    });
    setRecentQuizzes(quizData ?? []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
  }, [user, statusMap]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'おはようございます' : greetingHour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.username}>{user?.email?.split('@')[0] ?? 'Learner'}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 60 }} />
        ) : stats ? (
          <>
            {/* Overall Progress */}
            <View style={styles.progressCard}>
              <Text style={styles.sectionTitle}>Overall Progress</Text>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatNum}>{stats.studiedCount}</Text>
                <Text style={styles.bigStatLabel}>/ {stats.totalVocab} words mastered</Text>
              </View>
              <ProgressBar
                progress={stats.totalVocab > 0 ? stats.studiedCount / stats.totalVocab : 0}
                color={COLORS.studied}
                height={8}
              />
              <View style={styles.statRow}>
                <StatChip label="Studying" value={stats.studyingCount} color={COLORS.studying} />
                <StatChip label="Studied" value={stats.studiedCount} color={COLORS.studied} />
                <StatChip label="Unread" value={stats.unreadCount} color={COLORS.unread} />
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionGrid}>
              <ActionCard
                emoji="📚"
                label="Browse Vocab"
                sub="By chapter & section"
                color={COLORS.primary}
                onPress={() => router.push('/(tabs)/vocabulary')}
              />
              <ActionCard
                emoji="✅"
                label="Studied"
                sub={`${stats.studiedCount} words`}
                color={COLORS.studied}
                onPress={() => router.push('/(tabs)/studied')}
              />
              <ActionCard
                emoji="✏️"
                label="Studying"
                sub={`${stats.studyingCount} words`}
                color={COLORS.studying}
                onPress={() => router.push('/(tabs)/studied')}
              />
              <ActionCard
                emoji="🧠"
                label="Start Quiz"
                sub="Test yourself"
                color={COLORS.accent}
                onPress={() => router.push('/(tabs)/quiz')}
              />
            </View>

            {/* Quiz Stats */}
            {stats.quizCount > 0 && (
              <View style={styles.quizStats}>
                <Text style={styles.sectionTitle}>Quiz Performance</Text>
                <View style={styles.quizRow}>
                  <View style={[styles.quizStatCard, { backgroundColor: COLORS.primaryMuted }]}>
                    <Text style={[styles.quizStatNum, { color: COLORS.primary }]}>{stats.quizCount}</Text>
                    <Text style={styles.quizStatLabel}>Quizzes Taken</Text>
                  </View>
                  <View style={[styles.quizStatCard, { backgroundColor: COLORS.studiedMuted }]}>
                    <Text style={[styles.quizStatNum, { color: COLORS.studied }]}>{stats.avgScore}%</Text>
                    <Text style={styles.quizStatLabel}>Avg Score</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tip */}
            <View style={styles.tipCard}>
              <Text style={styles.tipEmoji}>💡</Text>
              <Text style={styles.tipText}>
                Tap any vocab card to expand examples. Cycle through Unread → Studying → Studied as you learn!
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statChip, { borderColor: color }]}>
      <Text style={[styles.statChipNum, { color }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color }]}>{label}</Text>
    </View>
  );
}

function ActionCard({
  emoji, label, sub, color, onPress,
}: {
  emoji: string; label: string; sub: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.actionCard, { borderColor: `${color}30` }]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xxl,
  },
  greeting: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  username: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: COLORS.text },
  signOutBtn: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.bgCard },
  signOutText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm },
  progressCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: SPACING.sm },
  bigStat: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  bigStatNum: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.heavy, color: COLORS.studied },
  bigStatLabel: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },
  statRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  statChip: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1 },
  statChipNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  statChipLabel: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.medium },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
  actionCard: {
    width: '47%',
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    gap: SPACING.xs,
    ...SHADOWS.card,
  },
  actionEmoji: { fontSize: 28 },
  actionLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
  actionSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  quizStats: { marginBottom: SPACING.xl },
  quizRow: { flexDirection: 'row', gap: SPACING.md },
  quizStatCard: { flex: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center' },
  quizStatNum: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy },
  quizStatLabel: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: 4 },
  tipCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: COLORS.primaryMuted,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  tipEmoji: { fontSize: 20 },
  tipText: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 20 },
});
