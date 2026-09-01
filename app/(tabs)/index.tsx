import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Modal,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useVocabStore } from '../../src/stores/vocabStore';
import { useVerbStore } from '../../src/stores/verbStore';
import { useGeneralWordStore } from '../../src/stores/generalWordStore';
import { useNavigationStore } from '../../src/stores/navigationStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { synthesizeSpeech } from '../../src/lib/tts';
import { getThemeColors, FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../../src/constants/colors';
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
  totalGeneralWords: number;
  streak: number;
}

interface DayBar {
  label: string;
  date: string;
  studied: number;
  studying: number;
}

export interface RevisionWord {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  source: 'course' | 'general';
  categoryOrChapter: string;
  status: 'studying' | 'studied';
  updated_at: string;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { statusMap, updateStatus: updateVocabStatus } = useVocabStore();
  const { fetchStatuses: fetchVerbStatuses } = useVerbStore();
  const { fetchWords: fetchGW, fetchStatuses: fetchGWStatuses, updateStatus: updateGWStatus } = useGeneralWordStore();
  const { lastLocation, hydrate } = useNavigationStore();
  const { hydrate: hydrateSettings, inworldApiKey, inworldModel, inworldVoice } = useSettingsStore();
  const { scheme, toggle: toggleTheme } = useThemeStore();
  const C = getThemeColors(scheme);

  const [stats, setStats] = useState<OverallStats | null>(null);
  const [chartData, setChartData] = useState<DayBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Revision / History from Last Session ───────────────────
  const [revisionWords, setRevisionWords] = useState<RevisionWord[]>([]);
  const [revisionDateLabel, setRevisionDateLabel] = useState<string>('');
  const [revisionModalVisible, setRevisionModalVisible] = useState<boolean>(false);
  const [revisionFilter, setRevisionFilter] = useState<'all' | 'studying' | 'studied'>('all');

  // ── Fetch all stats & revision words ───────────────────────

  const fetchStats = async () => {
    if (!user) return;

    try {
      // 1. Vocabulary (Course)
      const { count: totalVocab } = await supabase
        .from('vocabulary')
        .select('*', { count: 'exact', head: true });

      const { data: statusData } = await supabase
        .from('user_vocab_status')
        .select('chapter, section, no, status, updated_at')
        .eq('user_id', user.id);

      const courseStudiedCount = statusData?.filter((r) => r.status === 'studied').length ?? 0;
      const courseStudyingCount = statusData?.filter((r) => r.status === 'studying').length ?? 0;

      // 2. Verbs
      const { count: totalVerbs } = await supabase
        .from('verb')
        .select('*', { count: 'exact', head: true });

      const { data: verbStatusData } = await supabase
        .from('user_verb_status')
        .select('status')
        .eq('user_id', user.id);

      const verbsStudied = verbStatusData?.filter((r) => r.status === 'studied').length ?? 0;
      const verbsStudying = verbStatusData?.filter((r) => r.status === 'studying').length ?? 0;

      // 3. General Words
      const { count: totalGeneralWords } = await supabase
        .from('general_words')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.is.null,user_id.eq.${user.id}`);

      const { data: gwStatusData } = await supabase
        .from('user_general_word_status')
        .select('word_id, status, updated_at')
        .eq('user_id', user.id);

      const gwStudiedCount = gwStatusData?.filter((r) => r.status === 'studied').length ?? 0;
      const gwStudyingCount = gwStatusData?.filter((r) => r.status === 'studying').length ?? 0;

      // Total words & counts combined
      const studiedCount = courseStudiedCount + gwStudiedCount;
      const studyingCount = courseStudyingCount + gwStudyingCount;
      const totalAll = (totalVocab ?? 0) + (totalGeneralWords ?? 0);
      const unreadCount = Math.max(0, totalAll - studiedCount - studyingCount);

      // 4. Quiz Sessions
      const { data: quizData } = await supabase
        .from('quiz_sessions')
        .select('total_questions, correct_answers, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10);

      const avgScore =
        quizData && quizData.length > 0
          ? quizData.reduce((s, q) => s + (q.correct_answers / (q.total_questions || 1)) * 100, 0) / quizData.length
          : 0;

      // ── 7-day activity chart ──
      const bars: DayBar[] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });

        const vocabDayRows = statusData?.filter((r) => r.updated_at && r.updated_at.slice(0, 10) === iso) ?? [];
        const gwDayRows = gwStatusData?.filter((r) => r.updated_at && r.updated_at.slice(0, 10) === iso) ?? [];

        bars.push({
          label,
          date: iso,
          studied:
            vocabDayRows.filter((r) => r.status === 'studied').length +
            gwDayRows.filter((r) => r.status === 'studied').length,
          studying:
            vocabDayRows.filter((r) => r.status === 'studying').length +
            gwDayRows.filter((r) => r.status === 'studying').length,
        });
      }
      setChartData(bars);

      // ── Streak calculation ──
      let streak = 0;
      const check = new Date(today);
      for (let i = 0; i < 365; i++) {
        const iso = check.toISOString().split('T')[0];
        const hasVocab = statusData?.some(
          (r) => r.updated_at && r.updated_at.slice(0, 10) === iso && (r.status === 'studied' || r.status === 'studying')
        );
        const hasGW = gwStatusData?.some(
          (r) => r.updated_at && r.updated_at.slice(0, 10) === iso && (r.status === 'studied' || r.status === 'studying')
        );
        if (hasVocab || hasGW) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else {
          break;
        }
      }

      // ── Find Last Session Active Date for Revision ──
      const allActivityDates = Array.from(
        new Set([
          ...(statusData || [])
            .filter((r) => r.status === 'studied' || r.status === 'studying')
            .map((r) => r.updated_at?.slice(0, 10))
            .filter(Boolean),
          ...(gwStatusData || [])
            .filter((r) => r.status === 'studied' || r.status === 'studying')
            .map((r) => r.updated_at?.slice(0, 10))
            .filter(Boolean),
        ])
      ).sort((a, b) => b!.localeCompare(a!)) as string[];

      const todayIso = today.toISOString().split('T')[0];
      const previousDate = allActivityDates.find((d) => d < todayIso);
      const targetRevisionDate = previousDate || allActivityDates[0];

      if (targetRevisionDate) {
        const dObj = new Date(targetRevisionDate + 'T12:00:00');
        const diffDays = Math.round((today.getTime() - dObj.getTime()) / (1000 * 3600 * 24));
        const dateLabel =
          diffDays === 0
            ? 'Today'
            : diffDays === 1
            ? 'Yesterday'
            : dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setRevisionDateLabel(dateLabel);

        const targetVocabRows = (statusData || []).filter(
          (r) => r.updated_at?.slice(0, 10) === targetRevisionDate && (r.status === 'studied' || r.status === 'studying')
        );
        const targetGWRows = (gwStatusData || []).filter(
          (r) => r.updated_at?.slice(0, 10) === targetRevisionDate && (r.status === 'studied' || r.status === 'studying')
        );

        const revList: RevisionWord[] = [];

        if (targetVocabRows.length > 0) {
          const { data: allVWords } = await supabase
            .from('vocabulary')
            .select('chapter, chapter_name, section, section_name, no, word_kanji, reading, meaning');

          if (allVWords) {
            for (const stRow of targetVocabRows) {
              const matched = allVWords.find(
                (v) => v.chapter === stRow.chapter && v.section === stRow.section && v.no === stRow.no
              );
              if (matched) {
                revList.push({
                  id: `${matched.chapter}_${matched.section}_${matched.no}`,
                  word: matched.word_kanji,
                  reading: matched.reading,
                  meaning: matched.meaning,
                  source: 'course',
                  categoryOrChapter: `Ch.${matched.chapter} · ${matched.section_name || 'Sec.' + matched.section}`,
                  status: (stRow.status as any) || 'studying',
                  updated_at: stRow.updated_at || '',
                });
              }
            }
          }
        }

        if (targetGWRows.length > 0) {
          const gwIds = targetGWRows.map((r) => r.word_id);
          const { data: gwWords } = await supabase
            .from('general_words')
            .select('id, word_japanese, word_hiragana, word_english, category')
            .in('id', gwIds);

          if (gwWords) {
            for (const gw of gwWords) {
              const stRow = targetGWRows.find((r) => r.word_id === gw.id);
              revList.push({
                id: gw.id,
                word: gw.word_japanese,
                reading: gw.word_hiragana,
                meaning: gw.word_english,
                source: 'general',
                categoryOrChapter: gw.category || 'General Words',
                status: (stRow?.status as any) || 'studying',
                updated_at: stRow?.updated_at || '',
              });
            }
          }
        }

        setRevisionWords(revList);
      } else {
        setRevisionWords([]);
      }

      setStats({
        totalVocab: totalVocab ?? 0,
        studiedCount,
        studyingCount,
        unreadCount,
        quizCount: quizData?.length ?? 0,
        avgScore: Math.round(avgScore),
        totalVerbs: totalVerbs ?? 0,
        verbsStudied,
        verbsStudying,
        totalGeneralWords: totalGeneralWords ?? 0,
        streak: streak > 0 ? streak : 0,
      });
    } catch (e) {
      console.error('Error in fetchStats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    if (user) {
      fetchVerbStatuses(user.id);
      fetchGW(user.id);
      fetchGWStatuses(user.id);
    }
    hydrate();
    hydrateSettings();
  }, [user, statusMap]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const greetingHour = new Date().getHours();
  const greetingJp = greetingHour < 12 ? 'おはようございます' : greetingHour < 18 ? 'こんにちは' : 'こんばんは';

  const styles = useMemo(() => makeStyles(C), [C]);

  const totalAllWords = (stats?.totalVocab ?? 0) + (stats?.totalGeneralWords ?? 0);
  const masteryPercentage = totalAllWords > 0 ? Math.round(((stats?.studiedCount ?? 0) / totalAllWords) * 100) : 0;

  // Filtered revision words
  const filteredRevisionWords = useMemo(() => {
    if (revisionFilter === 'all') return revisionWords;
    return revisionWords.filter((w) => w.status === revisionFilter);
  }, [revisionWords, revisionFilter]);

  const handleToggleRevisionStatus = async (item: RevisionWord) => {
    if (!user) return;
    const nextStatus = item.status === 'studied' ? 'studying' : 'studied';
    if (item.source === 'course') {
      await updateVocabStatus(user.id, item.id, nextStatus);
    } else {
      await updateGWStatus(user.id, item.id, nextStatus);
    }
    setRevisionWords((prev) =>
      prev.map((w) => (w.id === item.id ? { ...w, status: nextStatus } : w))
    );
    fetchStats();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Top Navbar Header ─────────────────────────────────────── */}
        <View style={styles.navBar}>
          <View style={styles.userProfileRow}>
            <View style={styles.avatarPill}>
              <Text style={styles.avatarKanji}>学</Text>
            </View>
            <View style={{ marginLeft: SPACING.sm }}>
              <Text style={styles.greetingJpText}>{greetingJp}</Text>
              <Text style={styles.userNameText}>{user?.email?.split('@')[0] ?? 'Learner'}</Text>
            </View>
          </View>

          <View style={styles.navActionsRow}>
            {/* Streak indicator */}
            {stats && (
              <View style={styles.streakBadge}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakText}>{stats.streak}d</Text>
              </View>
            )}

            {/* Theme switch */}
            <TouchableOpacity onPress={toggleTheme} style={styles.navIconBtn} activeOpacity={0.8}>
              <Text style={styles.navIconText}>{scheme === 'dark' ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/settings')}
              style={styles.navIconBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.navIconText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 60 }} />
        ) : stats ? (
          <>
            {/* ── 2. Continue Learning Ribbon ─────────────────────────── */}
            {lastLocation && <ContinueCard location={lastLocation} C={C} styles={styles} />}

            {/* ── 3. Hero Mastery Dashboard Card ──────────────────────── */}
            <View style={styles.heroCard}>
              <Text style={styles.heroWatermark}>達</Text>

              <View style={styles.heroHeaderRow}>
                <View style={styles.heroTierBadge}>
                  <Text style={styles.heroTierBadgeText}>🎯 COURSE MASTERY</Text>
                </View>
                <View style={styles.masteryPill}>
                  <Text style={styles.masteryPillText}>{masteryPercentage}% Complete</Text>
                </View>
              </View>

              <View style={styles.heroMainMetricRow}>
                <View>
                  <Text style={styles.heroBigNum}>{stats.studiedCount}</Text>
                  <Text style={styles.heroBigSub}>of {totalAllWords} total words mastered</Text>
                </View>
              </View>

              <View style={{ marginVertical: SPACING.md }}>
                <ProgressBar
                  progress={totalAllWords > 0 ? stats.studiedCount / totalAllWords : 0}
                  color="#4CAF82"
                  height={8}
                />
              </View>

              <View style={styles.heroStatChipsRow}>
                <View style={styles.heroStatChip}>
                  <View style={[styles.pulseDot, { backgroundColor: '#F5A623' }]} />
                  <Text style={styles.heroStatChipNum}>{stats.studyingCount}</Text>
                  <Text style={styles.heroStatChipLabel}>Studying</Text>
                </View>
                <View style={styles.heroStatChip}>
                  <View style={[styles.pulseDot, { backgroundColor: '#4CAF82' }]} />
                  <Text style={styles.heroStatChipNum}>{stats.studiedCount}</Text>
                  <Text style={styles.heroStatChipLabel}>Mastered</Text>
                </View>
                <View style={styles.heroStatChip}>
                  <View style={[styles.pulseDot, { backgroundColor: '#6B7280' }]} />
                  <Text style={styles.heroStatChipNum}>{stats.unreadCount}</Text>
                  <Text style={styles.heroStatChipLabel}>In Queue</Text>
                </View>
              </View>
            </View>

            {/* ── 4. Revision & History of Last Session Card ─────────── */}
            {revisionWords.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.revisionCard}
                onPress={() => setRevisionModalVisible(true)}
              >
                <View style={styles.revisionLeft}>
                  <View style={styles.revisionIconCircle}>
                    <Text style={{ fontSize: 20 }}>📖</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.revisionCardTitle}>Last Session Revision</Text>
                      <View style={styles.revisionDatePill}>
                        <Text style={styles.revisionDateText}>{revisionDateLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.revisionCardSub}>
                      {revisionWords.length} words studied or learning · Quick memory check
                    </Text>
                    {/* Mini preview chips */}
                    <View style={styles.revisionChipsRow}>
                      {revisionWords.slice(0, 4).map((w, idx) => (
                        <View key={idx} style={styles.miniWordChip}>
                          <Text style={styles.miniWordText}>{w.word}</Text>
                        </View>
                      ))}
                      {revisionWords.length > 4 && (
                        <Text style={styles.miniWordMore}>+{revisionWords.length - 4}</Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.revisionActionBtn}>
                  <Text style={styles.revisionActionBtnText}>Revise ›</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* ── 5. Featured Daily Challenge Card ────────────────────── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Daily Challenge</Text>
              <Text style={styles.sectionSub}>Quiz & Retention</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.challengeCard}
              onPress={() => router.push('/(tabs)/quiz')}
            >
              <View style={styles.challengeLeft}>
                <View style={styles.challengeIconBox}>
                  <Text style={styles.challengeEmoji}>🧠</Text>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <View style={styles.challengeBadgeRow}>
                    <Text style={styles.challengeTitle}>Speed Quiz Drill</Text>
                    <View style={styles.challengeScorePill}>
                      <Text style={styles.challengeScoreText}>
                        {stats.quizCount > 0 ? `${stats.avgScore}% avg` : '✦ Ready'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.challengeSub}>
                    Test vocabulary retention & strengthen memory recall
                  </Text>
                </View>
              </View>
              <View style={styles.challengeArrowPill}>
                <Text style={styles.challengeArrow}>Start ›</Text>
              </View>
            </TouchableOpacity>

            {/* ── 6. Curated Study Hub Grid ───────────────────────────── */}
            <View style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
              <Text style={styles.sectionTitle}>Study Hub</Text>
              <Text style={styles.sectionSub}>Core Modules</Text>
            </View>

            {/* Row 1: General Words & AI + Course Vocab */}
            <View style={styles.hubGridRow}>
              <HubCard
                icon="✨"
                title="General Words"
                subtitle="AI OCR & Sensei Chat"
                accentColor="#8B5CF6"
                badge={`${stats.totalGeneralWords} words`}
                onPress={() => router.push('/(tabs)/general-words' as any)}
                C={C}
              />
              <HubCard
                icon="📚"
                title="Course Vocab"
                subtitle="Chapters & Sections"
                accentColor="#3B82F6"
                badge={`${stats.totalVocab} words`}
                onPress={() => router.push('/(tabs)/vocabulary')}
                C={C}
              />
            </View>

            {/* Row 2: Audio Immersion + Verb Conjugator */}
            <View style={styles.hubGridRow}>
              <HubCard
                icon="🎙️"
                title="Audio Immersion"
                subtitle="AI Listening Practice"
                accentColor="#EC4899"
                badge="AI TTS"
                onPress={() => router.push('/(tabs)/audio')}
                C={C}
              />
              <HubCard
                icon="動"
                isKanji
                title="Verb Conjugations"
                subtitle="6-Form Verb Drills"
                accentColor="#F5A623"
                badge={`${stats.verbsStudied}/${stats.totalVerbs}`}
                onPress={() => router.push('/(tabs)/verbs')}
                C={C}
              />
            </View>

            {/* Row 3: Study Notes + Studied Archive */}
            <View style={styles.hubGridRow}>
              <HubCard
                icon="📔"
                title="Study Journal"
                subtitle="Daily Notes & Log"
                accentColor="#10B981"
                badge="Journal"
                onPress={() => router.push('/(tabs)/studybook')}
                C={C}
              />
              <HubCard
                icon="✅"
                title="Mastered Words"
                subtitle="Completed Archive"
                accentColor="#06B6D4"
                badge={`${stats.studiedCount} done`}
                onPress={() => router.push('/(tabs)/studied')}
                C={C}
              />
            </View>

            {/* ── 7. 7-Day Activity Visualizer ────────────────────────── */}
            <View style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View>
                  <Text style={styles.activityTitle}>7-Day Learning Activity</Text>
                  <Text style={styles.activitySub}>Consistent daily review builds fluency</Text>
                </View>
                <View style={styles.activityLegend}>
                  <View style={[styles.legendDot, { backgroundColor: '#4CAF82' }]} />
                  <Text style={styles.legendLabel}>Mastered</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#F5A623', marginLeft: 6 }]} />
                  <Text style={styles.legendLabel}>Studying</Text>
                </View>
              </View>
              <WeekChart data={chartData} C={C} />
            </View>

            {/* ── 8. Quick Metrics Quad ───────────────────────────────── */}
            <View style={styles.metricsQuadGrid}>
              <MetricItem
                emoji="🔥"
                label="Study Streak"
                value={`${stats.streak}d`}
                sub="Days in action"
                color="#F5A623"
                C={C}
              />
              <MetricItem
                emoji="📈"
                label="Mastery Rate"
                value={`${masteryPercentage}%`}
                sub="Total retention"
                color="#4CAF82"
                C={C}
              />
              <MetricItem
                emoji="🧠"
                label="Quiz Accuracy"
                value={stats.quizCount > 0 ? `${stats.avgScore}%` : '—'}
                sub={`${stats.quizCount} tests taken`}
                color="#8B5CF6"
                C={C}
              />
              <MetricItem
                emoji="📝"
                label="Today's Words"
                value={`${(chartData[chartData.length - 1]?.studied || 0) + (chartData[chartData.length - 1]?.studying || 0)}`}
                sub="Words reviewed"
                color="#3B82F6"
                C={C}
              />
            </View>
          </>
        ) : null}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>

      {/* ── REVISION MODAL / HISTORY SHEET ─────────────────────── */}
      <Modal
        visible={revisionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRevisionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Last Session Revision</Text>
                <Text style={styles.modalSub}>
                  {revisionDateLabel} · {revisionWords.length} words studied
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRevisionModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Tabs */}
            <View style={styles.revFilterRow}>
              {(['all', 'studying', 'studied'] as const).map((f) => {
                const count =
                  f === 'all'
                    ? revisionWords.length
                    : revisionWords.filter((w) => w.status === f).length;
                const active = revisionFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setRevisionFilter(f)}
                    style={[styles.revFilterChip, active && styles.revFilterChipActive]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.revFilterChipText,
                        active && styles.revFilterChipTextActive,
                      ]}
                    >
                      {f === 'all' ? 'All' : f === 'studying' ? '✏️ Studying' : '✅ Mastered'} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Word List */}
            <FlatList
              data={filteredRevisionWords}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: SPACING.xxl }}
              renderItem={({ item }) => (
                <RevisionWordItem
                  item={item}
                  onToggleStatus={() => handleToggleRevisionStatus(item)}
                  inworldApiKey={inworldApiKey}
                  inworldModel={inworldModel}
                  inworldVoice={inworldVoice}
                  C={C}
                />
              )}
            />

            {/* Bottom Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalQuizBtn}
                onPress={() => {
                  setRevisionModalVisible(false);
                  router.push({
                    pathname: '/(tabs)/quiz',
                    params: { autoStart: 'true' },
                  } as any);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.modalQuizBtnText}>🎯 Quiz on These Words</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Revision Word Item with Audio TTS ─────────────────────────────────────────

function RevisionWordItem({
  item,
  onToggleStatus,
  inworldApiKey,
  inworldModel,
  inworldVoice,
  C,
}: {
  item: RevisionWord;
  onToggleStatus: () => void;
  inworldApiKey: string;
  inworldModel: string;
  inworldVoice: string;
  C: ThemeColors;
}) {
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const player = useAudioPlayer(audioUri || '');

  const handlePlayAudio = async () => {
    if (loadingAudio) return;
    try {
      setLoadingAudio(true);
      if (!audioUri) {
        const synth = await synthesizeSpeech(
          item.word,
          inworldApiKey,
          inworldModel || 'inworld-tts-2',
          inworldVoice || 'Asuka'
        );
        setAudioUri(synth.fileUri);
      }
      player.play();
    } catch (err) {
      console.error('Audio playback error:', err);
    } finally {
      setLoadingAudio(false);
    }
  };

  const isStudied = item.status === 'studied';

  return (
    <View style={[stylesRevItem.card, { backgroundColor: C.bgElevated, borderColor: C.border }]}>
      <View style={stylesRevItem.mainRow}>
        <View style={{ flex: 1 }}>
          <View style={stylesRevItem.wordHeader}>
            <Text style={[stylesRevItem.wordJp, { color: C.text }]}>{item.word}</Text>
            {/* Audio Button */}
            <TouchableOpacity
              onPress={handlePlayAudio}
              style={[stylesRevItem.audioBtn, { backgroundColor: `${C.primary}18`, borderColor: `${C.primary}30` }]}
              activeOpacity={0.7}
            >
              {loadingAudio ? (
                <ActivityIndicator size="small" color={C.primary} />
              ) : (
                <Text style={{ fontSize: 13 }}>🔊</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={[stylesRevItem.reading, { color: C.primaryLight }]}>{item.reading}</Text>
          <Text style={[stylesRevItem.meaning, { color: C.text }]}>{item.meaning}</Text>
        </View>

        {/* Status toggle pill */}
        <TouchableOpacity
          onPress={onToggleStatus}
          style={[
            stylesRevItem.statusPill,
            isStudied
              ? { backgroundColor: 'rgba(76, 175, 130, 0.15)', borderColor: 'rgba(76, 175, 130, 0.4)' }
              : { backgroundColor: 'rgba(245, 166, 35, 0.15)', borderColor: 'rgba(245, 166, 35, 0.4)' },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[stylesRevItem.statusText, { color: isStudied ? '#4CAF82' : '#F5A623' }]}>
            {isStudied ? '✓ Mastered' : '✏️ Studying'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={stylesRevItem.footerRow}>
        <Text style={[stylesRevItem.sourceText, { color: C.textMuted }]}>
          {item.source === 'course' ? '📖 ' : '✨ '}
          {item.categoryOrChapter}
        </Text>
      </View>
    </View>
  );
}

const stylesRevItem = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordJp: {
    fontSize: 18,
    fontWeight: '800',
  },
  audioBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reading: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  meaning: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

// ── Hub Card Component ────────────────────────────────────────────────────────

function HubCard({
  icon,
  isKanji = false,
  title,
  subtitle,
  accentColor,
  badge,
  onPress,
  C,
}: {
  icon: string;
  isKanji?: boolean;
  title: string;
  subtitle: string;
  accentColor: string;
  badge?: string;
  onPress: () => void;
  C: ThemeColors;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[
          stylesCard.card,
          {
            backgroundColor: C.bgCard,
            borderColor: C.border,
          },
        ]}
      >
        <View style={stylesCard.topRow}>
          <View style={[stylesCard.iconBox, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}30` }]}>
            <Text
              style={
                isKanji
                  ? { fontSize: 19, fontWeight: '900', color: accentColor }
                  : { fontSize: 20 }
              }
            >
              {icon}
            </Text>
          </View>
          {badge && (
            <View style={[stylesCard.badge, { backgroundColor: `${accentColor}15` }]}>
              <Text style={[stylesCard.badgeText, { color: accentColor }]}>{badge}</Text>
            </View>
          )}
        </View>

        <Text style={[stylesCard.title, { color: C.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[stylesCard.subtitle, { color: C.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>

        {/* Accent bottom neon hairline */}
        <View style={[stylesCard.accentBar, { backgroundColor: accentColor }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const stylesCard = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
  },
});

// ── Metric Item ───────────────────────────────────────────────────────────────

function MetricItem({
  emoji,
  label,
  value,
  sub,
  color,
  C,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
  color: string;
  C: ThemeColors;
}) {
  return (
    <View style={[stylesMetric.card, { backgroundColor: C.bgCard, borderColor: C.border }]}>
      <View style={stylesMetric.topRow}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
        <Text style={[stylesMetric.value, { color }]}>{value}</Text>
      </View>
      <Text style={[stylesMetric.label, { color: C.text }]}>{label}</Text>
      <Text style={[stylesMetric.sub, { color: C.textMuted }]}>{sub}</Text>
    </View>
  );
}

const stylesMetric = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  sub: {
    fontSize: 10,
    marginTop: 1,
  },
});

// ── 7-Day Chart ───────────────────────────────────────────────────────────────

function WeekChart({ data, C }: { data: DayBar[]; C: ThemeColors }) {
  const maxVal = Math.max(...data.map((d) => d.studied + d.studying), 1);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 105, marginTop: SPACING.sm }}>
      {data.map((bar, i) => {
        const total = bar.studied + bar.studying;
        const studiedH = (bar.studied / maxVal) * 58;
        const studyingH = (bar.studying / maxVal) * 58;
        const isToday = bar.date === today;

        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            {/* Count above column */}
            <Text
              style={{
                fontSize: 9,
                fontWeight: '700',
                color: total > 0 ? (isToday ? C.primaryLight : C.text) : 'transparent',
                height: 12,
              }}
            >
              {total > 0 ? total : ''}
            </Text>

            {/* Pill Capsule Column */}
            <View
              style={{
                width: '100%',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: 62,
                backgroundColor: isToday ? 'rgba(124, 106, 247, 0.08)' : 'transparent',
                borderRadius: RADIUS.sm,
              }}
            >
              {total === 0 ? (
                <View
                  style={{
                    width: '60%',
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: C.border,
                  }}
                />
              ) : (
                <View style={{ width: '60%', gap: 1 }}>
                  {bar.studying > 0 && (
                    <View
                      style={{
                        height: Math.max(6, studyingH),
                        borderRadius: 3,
                        backgroundColor: '#F5A623',
                      }}
                    />
                  )}
                  {bar.studied > 0 && (
                    <View
                      style={{
                        height: Math.max(6, studiedH),
                        borderRadius: 3,
                        backgroundColor: '#4CAF82',
                      }}
                    />
                  )}
                </View>
              )}
            </View>

            {/* Label */}
            <Text
              style={{
                fontSize: 10,
                fontWeight: isToday ? '800' : '500',
                color: isToday ? C.primaryLight : C.textMuted,
              }}
            >
              {isToday ? 'Today' : bar.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Continue Card ─────────────────────────────────────────────────────────────

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
          <Text style={styles.continueLabel}>CONTINUE LAST LESSON</Text>
          <Text style={styles.continueTitle} numberOfLines={1}>
            {location.sectionName}
          </Text>
          <Text style={styles.continueMeta}>
            Ch.{location.chapterId} · {location.chapterName} · {timeAgo}
          </Text>
        </View>
      </View>
      <Text style={styles.continueArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── Main Stylesheet ───────────────────────────────────────────────────────────

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    content: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xs,
    },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    userProfileRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatarPill: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primaryMuted,
      borderWidth: 1.5,
      borderColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarKanji: {
      fontSize: 18,
      fontWeight: '900',
      color: C.primaryLight,
    },
    greetingJpText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.primaryLight,
      letterSpacing: 0.3,
    },
    userNameText: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
    },
    navActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(245, 166, 35, 0.15)',
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: 'rgba(245, 166, 35, 0.3)',
      gap: 3,
    },
    streakEmoji: {
      fontSize: 13,
    },
    streakText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#F5A623',
    },
    navIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.bgCard,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconText: {
      fontSize: 15,
    },
    continueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: SPACING.md,
      borderLeftWidth: 3.5,
      borderLeftColor: C.primary,
    },
    continueLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    continueBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    continueBadgeEmoji: {
      fontSize: 16,
    },
    continueInfo: {
      flex: 1,
    },
    continueLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: C.primaryLight,
      letterSpacing: 0.6,
    },
    continueTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: C.text,
      marginTop: 1,
    },
    continueMeta: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 2,
    },
    continueArrow: {
      fontSize: 20,
      color: C.textMuted,
      marginLeft: SPACING.xs,
    },
    heroCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: C.border,
      position: 'relative',
      overflow: 'hidden',
      marginBottom: SPACING.md,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
    heroWatermark: {
      position: 'absolute',
      right: -10,
      bottom: -15,
      fontSize: 110,
      fontWeight: '900',
      color: 'rgba(255, 255, 255, 0.03)',
      zIndex: -1,
    },
    heroHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroTierBadge: {
      backgroundColor: C.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      borderWidth: 0.8,
      borderColor: C.primary,
    },
    heroTierBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: C.primaryLight,
      letterSpacing: 0.5,
    },
    masteryPill: {
      backgroundColor: 'rgba(76, 175, 130, 0.15)',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      borderWidth: 0.8,
      borderColor: 'rgba(76, 175, 130, 0.4)',
    },
    masteryPillText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#4CAF82',
    },
    heroMainMetricRow: {
      marginTop: SPACING.sm,
    },
    heroBigNum: {
      fontSize: 34,
      fontWeight: '900',
      color: C.text,
      letterSpacing: 0.5,
    },
    heroBigSub: {
      fontSize: 13,
      color: C.textSecondary,
      marginTop: 2,
    },
    heroStatChipsRow: {
      flexDirection: 'row',
      gap: SPACING.xs,
    },
    heroStatChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      paddingVertical: 7,
      paddingHorizontal: 8,
      borderWidth: 0.8,
      borderColor: C.border,
      gap: 5,
    },
    pulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    heroStatChipNum: {
      fontSize: 13,
      fontWeight: '800',
      color: C.text,
    },
    heroStatChipLabel: {
      fontSize: 10,
      color: C.textMuted,
      fontWeight: '500',
    },

    // Revision Card on Dashboard
    revisionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1.2,
      borderColor: 'rgba(76, 175, 130, 0.4)',
      marginBottom: SPACING.md,
      shadowColor: '#4CAF82',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    revisionLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    revisionIconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(76, 175, 130, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    revisionCardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: C.text,
    },
    revisionDatePill: {
      backgroundColor: 'rgba(76, 175, 130, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: RADIUS.full,
    },
    revisionDateText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#4CAF82',
    },
    revisionCardSub: {
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 2,
    },
    revisionChipsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 6,
      flexWrap: 'wrap',
    },
    miniWordChip: {
      backgroundColor: C.bgElevated,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
      borderWidth: 0.8,
      borderColor: C.border,
    },
    miniWordText: {
      fontSize: 11,
      fontWeight: '600',
      color: C.text,
    },
    miniWordMore: {
      fontSize: 11,
      color: C.textMuted,
      fontWeight: '700',
    },
    revisionActionBtn: {
      backgroundColor: '#4CAF82',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: RADIUS.full,
      marginLeft: SPACING.xs,
    },
    revisionActionBtnText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFF',
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: SPACING.xs,
      marginTop: SPACING.xs,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: C.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sectionSub: {
      fontSize: 11,
      fontWeight: '600',
      color: C.textMuted,
    },
    challengeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: 'rgba(124, 106, 247, 0.4)',
      marginBottom: SPACING.md,
      shadowColor: '#7C6AF7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 5,
    },
    challengeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    challengeIconBox: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.md,
      backgroundColor: 'rgba(124, 106, 247, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(124, 106, 247, 0.3)',
    },
    challengeEmoji: {
      fontSize: 22,
    },
    challengeBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    challengeTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: C.text,
    },
    challengeScorePill: {
      backgroundColor: 'rgba(242, 95, 142, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: RADIUS.full,
    },
    challengeScoreText: {
      fontSize: 10,
      fontWeight: '700',
      color: C.accent,
    },
    challengeSub: {
      fontSize: 11,
      color: C.textSecondary,
      marginTop: 2,
    },
    challengeArrowPill: {
      backgroundColor: C.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      marginLeft: SPACING.xs,
    },
    challengeArrow: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFF',
    },
    hubGridRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    activityCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      marginTop: SPACING.xs,
      marginBottom: SPACING.md,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    activityTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: C.text,
    },
    activitySub: {
      fontSize: 10,
      color: C.textMuted,
      marginTop: 1,
    },
    activityLegend: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 3,
    },
    legendLabel: {
      fontSize: 9,
      fontWeight: '600',
      color: C.textMuted,
    },
    metricsQuadGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: C.bgCard,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '90%',
      padding: SPACING.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: C.text,
    },
    modalSub: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 2,
    },
    modalCloseBtn: {
      padding: 6,
    },
    modalCloseText: {
      fontSize: 16,
      color: C.textMuted,
      fontWeight: '700',
    },
    revFilterRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: SPACING.md,
    },
    revFilterChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      backgroundColor: C.bgElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    revFilterChipActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    revFilterChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: C.textMuted,
    },
    revFilterChipTextActive: {
      color: C.primaryLight,
      fontWeight: '700',
    },
    modalFooter: {
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    modalQuizBtn: {
      backgroundColor: C.primary,
      paddingVertical: 14,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
    },
    modalQuizBtnText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });
}
