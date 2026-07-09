import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVocabStore } from '../../src/stores/vocabStore';
import { useVerbStore } from '../../src/stores/verbStore';
import { useNavigationStore } from '../../src/stores/navigationStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { getThemeColors, FONTS, RADIUS, SHADOWS, SPACING } from '../../src/constants/colors';
import { ProgressBar } from '../../src/components/ProgressBar';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverallStats {
  totalVocab: number;
  studiedCount: number;
  studyingCount: number;
  unreadCount: number;
  quizCount: number;
  avgScore: number;
  totalVerbs: number;
  verbsStudied: number;
  verbsStudying: number;
  streak: number;
}

interface DayBar {
  label: string;   // "Mon", "Tue" etc.
  date: string;    // YYYY-MM-DD
  studied: number;
  studying: number;
}

// ── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, signOut } = useAuthStore();
  const { statusMap } = useVocabStore();
  const { fetchStatuses: fetchVerbStatuses } = useVerbStore();
  const { lastLocation, hydrate } = useNavigationStore();
  const { hydrate: hydrateSettings } = useSettingsStore();
  const { scheme, toggle: toggleTheme } = useThemeStore();
  const C = getThemeColors(scheme);

  const [stats, setStats] = useState<OverallStats | null>(null);
  const [chartData, setChartData] = useState<DayBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch all stats ───────────────────────────────────────────────────────

  const fetchStats = async () => {
    if (!user) return;

    const { count: totalVocab } = await supabase
      .from('vocabulary')
      .select('*', { count: 'exact', head: true });

    const { data: statusData } = await supabase
      .from('user_vocab_status')
      .select('status, updated_at')
      .eq('user_id', user.id);

    const studiedCount = statusData?.filter((r) => r.status === 'studied').length ?? 0;
    const studyingCount = statusData?.filter((r) => r.status === 'studying').length ?? 0;
    const unreadCount = (totalVocab ?? 0) - studiedCount - studyingCount;

    const { count: totalVerbs } = await supabase
      .from('verb').select('*', { count: 'exact', head: true });
    const { data: verbStatusData } = await supabase
      .from('user_verb_status').select('status').eq('user_id', user.id);
    const verbsStudied = verbStatusData?.filter((r) => r.status === 'studied').length ?? 0;
    const verbsStudying = verbStatusData?.filter((r) => r.status === 'studying').length ?? 0;

    const { data: quizData } = await supabase
      .from('quiz_sessions')
      .select('total_questions, correct_answers, completed_at')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(10);

    const avgScore = quizData && quizData.length > 0
      ? quizData.reduce((s, q) => s + (q.correct_answers / q.total_questions) * 100, 0) / quizData.length
      : 0;

    // ── 7-day chart data ────────────────────────────────────────────────────
    const bars: DayBar[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayRows = statusData?.filter((r) => r.updated_at?.startsWith(iso)) ?? [];
      bars.push({
        label,
        date: iso,
        studied: dayRows.filter((r) => r.status === 'studied').length,
        studying: dayRows.filter((r) => r.status === 'studying').length,
      });
    }
    setChartData(bars);

    // ── Streak: consecutive days with any activity ──────────────────────────
    let streak = 0;
    const check = new Date(today);
    for (let i = 0; i < 365; i++) {
      const iso = check.toISOString().split('T')[0];
      const dayHasActivity = statusData?.some((r) => r.updated_at?.startsWith(iso)) ?? false;
      if (dayHasActivity) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }

    setStats({
      totalVocab: totalVocab ?? 0,
      studiedCount, studyingCount, unreadCount,
      quizCount: quizData?.length ?? 0,
      avgScore: Math.round(avgScore),
      totalVerbs: totalVerbs ?? 0,
      verbsStudied, verbsStudying,
      streak,
    });
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
    if (user) fetchVerbStatuses(user.id);
    hydrate();
    hydrateSettings();
  }, [user, statusMap]);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'おはようございます' : greetingHour < 18 ? 'こんにちは' : 'こんばんは';

  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/settings')}
            style={styles.settingsBtn}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.username}>{user?.email?.split('@')[0] ?? 'Learner'}</Text>
          </View>
          {/* Theme toggle — right in the header */}
          <TouchableOpacity
            onPress={toggleTheme}
            style={[styles.settingsBtn, { marginRight: SPACING.sm }]}
          >
            <Text style={styles.settingsIcon}>{scheme === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Out</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
        ) : stats ? (
          <>
            {/* ── Continue card ─────────────────────────── */}
            {lastLocation && <ContinueCard location={lastLocation} C={C} styles={styles} />}

            {/* ── Overall progress ──────────────────────── */}
            <View style={styles.progressCard}>
              <Text style={styles.sectionTitle}>Overall Progress</Text>
              <View style={styles.bigStat}>
                <Text style={styles.bigStatNum}>{stats.studiedCount}</Text>
                <Text style={styles.bigStatLabel}>/ {stats.totalVocab} words mastered</Text>
              </View>
              <ProgressBar
                progress={stats.totalVocab > 0 ? stats.studiedCount / stats.totalVocab : 0}
                color={C.studied}
                height={8}
              />
              <View style={styles.statRow}>
                <StatChip label="Studying" value={stats.studyingCount} color={C.studying} C={C} />
                <StatChip label="Studied" value={stats.studiedCount} color={C.studied} C={C} />
                <StatChip label="Unread" value={stats.unreadCount} color={C.unread} C={C} />
              </View>
            </View>

            {/* ── Quick Actions ─────────────────────────── */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>

            {/* Row 1 — 2 wide cards */}
            <View style={styles.actionRow}>
              <ActionCard
                size="medium"
                emoji="📚" label="Browse Vocab" sub="By chapter & section"
                color={C.primary} badge={`${stats.totalVocab}`} badgeLabel="words"
                onPress={() => router.push('/(tabs)/vocabulary')} C={C}
              />
              <ActionCard
                size="medium"
                emoji="📔" label="Study Book" sub="Daily journal"
                color={C.primaryLight} badge="✦" badgeLabel="journal"
                onPress={() => router.push('/(tabs)/studybook')} C={C}
              />
            </View>

            {/* Row 2 — 1 featured full-width card */}
            <View style={styles.actionRow}>
              <ActionCard
                size="featured"
                emoji="🧠" label="Start Quiz" sub="Test your knowledge · Challenge yourself"
                color={C.accent} badge={stats.quizCount > 0 ? `${stats.avgScore}%` : 'Start'} badgeLabel={stats.quizCount > 0 ? 'avg score' : 'now'}
                onPress={() => router.push('/(tabs)/quiz')} C={C}
              />
            </View>

            {/* Row 3 — 3 compact cards */}
            <View style={[styles.actionRow, { marginBottom: SPACING.xl }]}>
              <ActionCard
                size="small"
                emoji="動" label="Verbs" sub={`${stats.totalVerbs} verbs`}
                color={C.studying} badge={`${stats.verbsStudied}`} badgeLabel="done"
                onPress={() => router.push('/(tabs)/verbs')} isKanji C={C}
              />
              <ActionCard
                size="small"
                emoji="✅" label="Studied" sub={`${stats.studiedCount} words`}
                color={C.studied} badge={`${stats.studiedCount}`} badgeLabel="mastered"
                onPress={() => router.push('/(tabs)/studied')} C={C}
              />
              <ActionCard
                size="small"
                emoji="🎙️" label="Audio" sub="AI listening"
                color={C.jpRed} badge="AI" badgeLabel="powered"
                onPress={() => router.push('/(tabs)/audio')} C={C}
              />
            </View>

            {/* ── 7-Day Activity Chart ───────────────────── */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.sectionTitle}>7-Day Activity</Text>
                <View style={styles.chartLegend}>
                  <View style={[styles.legendDot, { backgroundColor: C.chartBar }]} />
                  <Text style={styles.legendText}>Studied</Text>
                  <View style={[styles.legendDot, { backgroundColor: C.chartBarSecondary }]} />
                  <Text style={styles.legendText}>Studying</Text>
                </View>
              </View>
              <WeekChart data={chartData} C={C} />
            </View>

            {/* ── Verb Progress ─────────────────────────── */}
            <View style={styles.verbCard}>
              <View style={styles.verbCardHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Verb Progress</Text>
                  <Text style={styles.verbCardSub}>{stats.totalVerbs} verbs total</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/verbs')} style={styles.verbSeeAll}>
                  <Text style={styles.verbSeeAllText}>See all ›</Text>
                </TouchableOpacity>
              </View>
              <ProgressBar
                progress={stats.totalVerbs > 0 ? stats.verbsStudied / stats.totalVerbs : 0}
                color={C.studying} height={6}
              />
              <View style={styles.statRow}>
                <StatChip label="Studying" value={stats.verbsStudying} color={C.studying} C={C} />
                <StatChip label="Studied" value={stats.verbsStudied} color={C.studied} C={C} />
                <StatChip
                  label="Unread"
                  value={Math.max(0, stats.totalVerbs - stats.verbsStudied - stats.verbsStudying)}
                  color={C.unread}
                  C={C}
                />
              </View>
            </View>

            {/* ── Bottom Stats Panel ────────────────────── */}
            <View style={styles.bottomStatsGrid}>
              <BottomStatCard
                emoji="🔥" label="Study Streak"
                value={stats.streak > 0 ? `${stats.streak}d` : '—'}
                sub={stats.streak > 0 ? 'days in a row' : 'Start today!'}
                color={C.studying} C={C}
              />
              <BottomStatCard
                emoji="📊" label="Completion"
                value={stats.totalVocab > 0 ? `${Math.round((stats.studiedCount / stats.totalVocab) * 100)}%` : '0%'}
                sub="vocab mastered"
                color={C.studied} C={C}
              />
              {stats.quizCount > 0 && (
                <BottomStatCard
                  emoji="🧠" label="Quiz Avg"
                  value={`${stats.avgScore}%`}
                  sub={`${stats.quizCount} quizzes taken`}
                  color={C.primary} C={C}
                />
              )}
              <BottomStatCard
                emoji="📝" label="Today"
                value={`${chartData[chartData.length - 1]?.studied + chartData[chartData.length - 1]?.studying || 0}`}
                sub="words touched"
                color={C.accent} C={C}
              />
            </View>
          </>
        ) : null}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 7-Day Bar Chart ───────────────────────────────────────────────────────────

function WeekChart({ data, C }: { data: DayBar[]; C: ReturnType<typeof getThemeColors> }) {
  const maxVal = Math.max(...data.map((d) => d.studied + d.studying), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 }}>
      {data.map((bar, i) => {
        const total = bar.studied + bar.studying;
        const studiedH = (bar.studied / maxVal) * 80;
        const studyingH = (bar.studying / maxVal) * 80;
        const isToday = bar.date === today;

        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {/* Bar */}
            <View style={{ width: '100%', alignItems: 'center', justifyContent: 'flex-end', height: 80 }}>
              {total === 0 ? (
                <View style={{
                  width: '65%', height: 4, borderRadius: 2,
                  backgroundColor: C.chartGrid,
                }} />
              ) : (
                <View style={{ width: '65%', gap: 1 }}>
                  {bar.studying > 0 && (
                    <View style={{
                      height: studyingH, borderRadius: 3,
                      backgroundColor: C.chartBarSecondary,
                    }} />
                  )}
                  {bar.studied > 0 && (
                    <View style={{
                      height: studiedH, borderRadius: 3,
                      backgroundColor: C.chartBar,
                    }} />
                  )}
                </View>
              )}
            </View>
            {/* Label */}
            <Text style={{
              fontSize: 10, fontWeight: isToday ? '800' : '500',
              color: isToday ? C.primary : C.textMuted,
            }}>
              {isToday ? 'Today' : bar.label}
            </Text>
            {/* Count */}
            {total > 0 && (
              <Text style={{ fontSize: 9, color: C.textMuted }}>{total}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Bottom Stat Card ──────────────────────────────────────────────────────────

function BottomStatCard({ emoji, label, value, sub, color, C }: {
  emoji: string; label: string; value: string; sub: string; color: string;
  C: ReturnType<typeof getThemeColors>;
}) {
  return (
    <View style={[{
      flex: 1, minWidth: '45%',
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: C.border,
      gap: SPACING.xs,
      ...SHADOWS.card,
    }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color }}>{value}</Text>
      <Text style={{ fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semibold, color: C.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: FONTS.sizes.xs, color: C.textMuted }}>{sub}</Text>
    </View>
  );
}

// ── ContinueCard ─────────────────────────────────────────────────────────────

function ContinueCard({ location, C, styles }: { location: any; C: any; styles: any }) {
  const timeAgo = (() => {
    if (!location.visitedAt) return '';
    const diff = Date.now() - new Date(location.visitedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.continueCard}
      onPress={() => router.push(`/(tabs)/vocabulary/${location.chapterId}/${location.sectionId}`)}
    >
      <View style={styles.continueLeft}>
        <View style={styles.continueBadge}>
          <Text style={styles.continueBadgeEmoji}>📍</Text>
        </View>
        <View style={styles.continueInfo}>
          <Text style={styles.continueLabel}>Continue where you left off</Text>
          <Text style={styles.continueTitle} numberOfLines={1}>{location.sectionName}</Text>
          <Text style={styles.continueMeta}>Ch.{location.chapterId} · {location.chapterName} · {timeAgo}</Text>
        </View>
      </View>
      <Text style={styles.continueArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color, C }: { label: string; value: number; color: string; C: any }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
      backgroundColor: `${color}15`, borderRadius: RADIUS.md }}>
      <Text style={{ fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.heavy, color }}>{value}</Text>
      <Text style={{ fontSize: FONTS.sizes.xs, color: C.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ── Reusable press animation hook ─────────────────────────────────────────────
function usePressAnim() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  return { scaleAnim, onPressIn, onPressOut };
}

// ── ActionCard — size variants: 'small' | 'medium' | 'featured' ───────────────
function ActionCard({ emoji, label, sub, color, onPress, isKanji = false, badge, badgeLabel, size = 'medium', C }: {
  emoji: string; label: string; sub: string; color: string;
  onPress: () => void; isKanji?: boolean;
  badge?: string; badgeLabel?: string;
  size?: 'small' | 'medium' | 'featured';
  C: ReturnType<typeof getThemeColors>;
}) {
  const { scaleAnim, onPressIn, onPressOut } = usePressAnim();

  // ── featured (full-width horizontal card) ─────────────────────────────────
  if (size === 'featured') {
    return (
      <Animated.View style={[{ flex: 1, transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
          activeOpacity={1}
          style={{
            backgroundColor: C.bgCard,
            borderRadius: RADIUS.xl,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: `${color}50`,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: color,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 10,
          }}
        >
          {/* Left icon zone */}
          <View style={{
            width: 90,
            alignSelf: 'stretch',
            backgroundColor: `${color}20`,
            alignItems: 'center',
            justifyContent: 'center',
            borderRightWidth: 1,
            borderRightColor: `${color}30`,
          }}>
            <Text style={{ fontSize: 40 }}>{emoji}</Text>
          </View>

          {/* Right content */}
          <View style={{ flex: 1, padding: SPACING.lg, gap: SPACING.xs }}>
            <Text style={{ fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.heavy, color: C.text }}>
              {label}
            </Text>
            <Text style={{ fontSize: FONTS.sizes.xs, color: C.textSecondary }} numberOfLines={1}>
              {sub}
            </Text>
            {badge && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.xs,
                backgroundColor: `${color}20`, borderRadius: RADIUS.full,
                paddingHorizontal: SPACING.md, paddingVertical: 4, alignSelf: 'flex-start',
              }}>
                <Text style={{ fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.heavy, color }}>{badge}</Text>
                {badgeLabel && <Text style={{ fontSize: 10, color: `${color}BB`, fontWeight: FONTS.weights.medium }}>{badgeLabel}</Text>}
              </View>
            )}
          </View>

          {/* Arrow */}
          <Text style={{ fontSize: 22, color, paddingRight: SPACING.lg, fontWeight: FONTS.weights.bold }}>›</Text>

          {/* Left neon glow strip */}
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── small (3-column compact card) ─────────────────────────────────────────
  if (size === 'small') {
    return (
      <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
          activeOpacity={1}
          style={{
            backgroundColor: C.bgCard,
            borderRadius: RADIUS.lg,
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: `${color}40`,
            alignItems: 'center',
            paddingVertical: SPACING.md,
            paddingHorizontal: SPACING.sm,
            shadowColor: color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 7,
            gap: SPACING.xs,
          }}
        >
          {/* Icon */}
          <View style={{
            width: 44, height: 44,
            borderRadius: RADIUS.md,
            backgroundColor: `${color}1A`,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: `${color}30`,
          }}>
            <Text style={isKanji
              ? { fontSize: 22, fontWeight: '900', color, textShadowColor: `${color}80`, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }
              : { fontSize: 22 }
            }>{emoji}</Text>
          </View>

          {/* Label */}
          <Text style={{ fontSize: 11, fontWeight: FONTS.weights.heavy, color: C.text, textAlign: 'center' }} numberOfLines={1}>
            {label}
          </Text>

          {/* Badge */}
          {badge && (
            <View style={{
              backgroundColor: `${color}18`, borderRadius: RADIUS.full,
              paddingHorizontal: 7, paddingVertical: 2,
            }}>
              <Text style={{ fontSize: 10, fontWeight: FONTS.weights.heavy, color }}>{badge}</Text>
            </View>
          )}

          {/* Bottom glow line */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, backgroundColor: color }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── medium (2-column default card) ────────────────────────────────────────
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        activeOpacity={1}
        style={{
          backgroundColor: C.bgCard,
          borderRadius: RADIUS.xl,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: `${color}40`,
          shadowColor: color,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {/* Colored icon zone */}
        <View style={{
          height: 76,
          backgroundColor: `${color}18`,
          alignItems: 'center',
          justifyContent: 'center',
          borderBottomWidth: 1,
          borderBottomColor: `${color}25`,
        }}>
          <Text style={isKanji
            ? { fontSize: 32, fontWeight: '900', color, textShadowColor: `${color}70`, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 }
            : { fontSize: 36 }
          }>{emoji}</Text>
        </View>

        <View style={{ padding: SPACING.md, gap: SPACING.xs }}>
          <Text style={{ fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.heavy, color: C.text, lineHeight: 18 }}>
            {label}
          </Text>
          <Text style={{ fontSize: 10, color: C.textMuted, lineHeight: 14 }} numberOfLines={1}>
            {sub}
          </Text>
          {badge && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs,
              backgroundColor: `${color}18`, borderRadius: RADIUS.full,
              paddingHorizontal: SPACING.sm, paddingVertical: 3, alignSelf: 'flex-start',
            }}>
              <Text style={{ fontSize: 11, fontWeight: FONTS.weights.heavy, color }}>{badge}</Text>
              {badgeLabel && <Text style={{ fontSize: 9, color: `${color}CC`, fontWeight: FONTS.weights.medium }}>{badgeLabel}</Text>}
            </View>
          )}
        </View>

        {/* Neon bottom line */}
        <View style={{ height: 3, backgroundColor: color }} />
      </TouchableOpacity>
    </Animated.View>
  );
}


// ── Styles factory ────────────────────────────────────────────────────────────

function makeStyles(C: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: SPACING.xxl,
    },
    headerIconBtn: {
      width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: C.bgCard,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
    },
    headerIconText: { fontSize: 18 },
    // Keep these for settings screen compat
    settingsBtn: {
      width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: C.bgCard,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
      marginRight: SPACING.md,
    },
    settingsIcon: { fontSize: 18 },
    greeting: { fontSize: FONTS.sizes.sm, color: C.textSecondary },
    username: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.bold, color: C.text },
    signOutBtn: {
      paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md, backgroundColor: C.bgCard,
    },
    signOutText: { color: C.textSecondary, fontSize: FONTS.sizes.sm },

    sectionTitle: {
      fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: C.text, marginBottom: SPACING.md,
    },

    progressCard: {
      backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
      marginBottom: SPACING.xl, borderWidth: 1, borderColor: C.border, ...SHADOWS.card,
    },
    bigStat: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm, marginBottom: SPACING.md },
    bigStatNum: { fontSize: FONTS.sizes.xxxl, fontWeight: FONTS.weights.heavy, color: C.text },
    bigStatLabel: { fontSize: FONTS.sizes.sm, color: C.textSecondary },
    statRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    actionRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },

    chartCard: {
      backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
      marginBottom: SPACING.xl, borderWidth: 1, borderColor: C.border, ...SHADOWS.card,
    },
    chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
    chartLegend: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: FONTS.sizes.xs, color: C.textMuted },

    verbCard: {
      backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
      marginBottom: SPACING.xl, borderWidth: 1, borderColor: C.border, ...SHADOWS.card,
    },
    verbCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
    verbCardSub: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
    verbSeeAll: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, backgroundColor: C.primaryMuted, borderRadius: RADIUS.full },
    verbSeeAllText: { fontSize: FONTS.sizes.sm, color: C.primary, fontWeight: FONTS.weights.semibold },

    bottomStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },

    // Continue card
    continueCard: {
      backgroundColor: C.bgCard, borderRadius: RADIUS.xl, padding: SPACING.lg,
      marginBottom: SPACING.xl, borderWidth: 1, borderColor: C.borderActive,
      flexDirection: 'row', alignItems: 'center', ...SHADOWS.card,
    },
    continueLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    continueBadge: {
      width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: C.primaryMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    continueBadgeEmoji: { fontSize: 22 },
    continueInfo: { flex: 1 },
    continueLabel: { fontSize: FONTS.sizes.xs, color: C.primary, fontWeight: FONTS.weights.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
    continueTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: C.text, marginTop: 2 },
    continueMeta: { fontSize: FONTS.sizes.xs, color: C.textMuted, marginTop: 2 },
    continueArrow: { fontSize: 22, color: C.textMuted, marginLeft: SPACING.sm },
  });
}
