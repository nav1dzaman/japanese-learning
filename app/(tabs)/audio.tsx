import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { generateAudioScript, JlptLevel, ScriptLength, WordFrequency, GeneratedScript } from '../../src/lib/groq';
import { synthesizeSpeech, SynthesisResult } from '../../src/lib/tts';
import { supabase } from '../../src/lib/supabase';
import { COLORS, FONTS, RADIUS, SPACING, SHADOWS } from '../../src/constants/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

type VocabFilter = 'studying' | 'studied';
type Step = 'configure' | 'generating' | 'player';

interface ChapterOption {
  chapter: number;
  chapter_name: string;
}

const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
const LENGTH_OPTIONS: { label: string; sub: string; value: ScriptLength }[] = [
  { label: 'Short', sub: '~60 words', value: 'short' },
  { label: 'Medium', sub: '~115 words', value: 'medium' },
  { label: 'Long', sub: '~185 words', value: 'long' },
];
const FREQUENCY_OPTIONS: { label: string; sub: string; value: WordFrequency; color: string }[] = [
  { label: 'High', sub: 'Mostly your words', value: 'high', color: COLORS.studied },
  { label: 'Medium', sub: 'Balanced mix', value: 'medium', color: COLORS.studying },
  { label: 'Low', sub: 'Natural flow', value: 'low', color: COLORS.primary },
];

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function AudioScreen() {
  const { user } = useAuthStore();
  const settings = useSettingsStore();

  const [step, setStep] = useState<Step>('configure');
  const [error, setError] = useState<string | null>(null);
  const [generatingMsg, setGeneratingMsg] = useState('Preparing...');

  // Configure
  const [vocabFilters, setVocabFilters] = useState<VocabFilter[]>(['studying']);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<number | 'all'>('all');
  const [jlptRange, setJlptRange] = useState<[number, number]>([0, 0]);
  const [scriptLength, setScriptLength] = useState<ScriptLength>('medium');
  const [wordFrequency, setWordFrequency] = useState<WordFrequency>('medium');

  // Player
  const [script, setScript] = useState<GeneratedScript | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);

  const player = useAudioPlayer(synthesis ? { uri: synthesis.fileUri } : null);
  const status = useAudioPlayerStatus(player);

  // Load chapters on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('vocabulary')
        .select('chapter, chapter_name')
        .order('chapter');
      if (data) {
        const unique: ChapterOption[] = [];
        const seen = new Set<number>();
        for (const row of data as any[]) {
          if (!seen.has(row.chapter)) {
            seen.add(row.chapter);
            unique.push({ chapter: row.chapter, chapter_name: row.chapter_name });
          }
        }
        setChapters(unique);
      }
    })();
  }, []);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setError(null);
    if (!settings.groqApiKey) {
      setError('Please set your Groq API key in Settings ⚙️ first.');
      return;
    }
    if (vocabFilters.length === 0) {
      setError('Please select at least one status (Studying or Studied).');
      return;
    }

    setStep('generating');
    try {
      setGeneratingMsg('Loading vocabulary...');

      // Fetch user's word statuses
      const statusQuery = supabase
        .from('user_vocab_status')
        .select('chapter, section, no, status')
        .eq('user_id', user?.id ?? '')
        .in('status', vocabFilters);
      if (selectedChapter !== 'all') {
        statusQuery.eq('chapter', selectedChapter);
      }
      const { data: statusData } = await statusQuery;

      // Fetch vocab rows (optionally filtered by chapter)
      const vocabQuery = supabase
        .from('vocabulary')
        .select('chapter, section, no, word_kanji, reading, meaning');
      if (selectedChapter !== 'all') {
        vocabQuery.eq('chapter', selectedChapter);
      }
      const { data: vocabData } = await vocabQuery;

      // Match
      const words: { word: string; reading: string; meaning: string }[] = [];
      if (statusData && vocabData) {
        const statusSet = new Set(statusData.map((r: any) => `${r.chapter}_${r.section}_${r.no}`));
        for (const row of vocabData as any[]) {
          if (statusSet.has(`${row.chapter}_${row.section}_${row.no}`)) {
            words.push({ word: row.word_kanji, reading: row.reading, meaning: row.meaning });
          }
        }
      }

      if (words.length === 0) {
        throw new Error(
          selectedChapter !== 'all'
            ? `No ${vocabFilters.join('/')} words in this chapter. Try another chapter or status.`
            : `No ${vocabFilters.join('/')} vocabulary found. Mark some words first.`
        );
      }

      const [start, end] = jlptRange;
      const levels = JLPT_LEVELS.slice(start, end + 1);

      setGeneratingMsg('Generating script with AI...');
      const generated = await generateAudioScript(
        words, levels, scriptLength, wordFrequency,
        settings.groqApiKey, settings.groqModel
      );
      setScript(generated);

      setGeneratingMsg('Synthesizing audio...');
      const synth = await synthesizeSpeech(
        generated.text,
        settings.inworldApiKey,
        settings.inworldModel,
        settings.inworldVoice
      );
      setSynthesis(synth);

      setStep('player');
    } catch (e: any) {
      setError(e?.message ?? 'An unexpected error occurred.');
      setStep('configure');
    }
  };

  const handleLevelPress = (idx: number) => {
    const [start, end] = jlptRange;
    if (idx < start) {
      setJlptRange(start - idx === 1 ? [idx, end] : [idx, idx]);
    } else if (idx > end) {
      setJlptRange(idx - end === 1 ? [start, idx] : [idx, idx]);
    } else if (idx === start && idx === end) {
      // single tap on only selection — keep it
    } else {
      setJlptRange([idx, idx]);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Audio Practice</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {step === 'configure' && (
        <ConfigureStep
          vocabFilters={vocabFilters}
          onToggleFilter={(f) =>
            setVocabFilters((prev) =>
              prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
            )
          }
          chapters={chapters}
          selectedChapter={selectedChapter}
          onSelectChapter={setSelectedChapter}
          jlptRange={jlptRange}
          onLevelPress={handleLevelPress}
          scriptLength={scriptLength}
          onLengthChange={setScriptLength}
          wordFrequency={wordFrequency}
          onFrequencyChange={setWordFrequency}
          error={error}
          onGenerate={handleGenerate}
        />
      )}

      {step === 'generating' && <GeneratingStep message={generatingMsg} />}

      {step === 'player' && script && synthesis && (
        <PlayerStep
          script={script}
          player={player}
          status={status}
          onRegenerate={() => {
            player.pause();
            setScript(null);
            setSynthesis(null);
            setStep('configure');
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Configure Step ─────────────────────────────────────────────────────────────

function ConfigureStep({
  vocabFilters, onToggleFilter,
  chapters, selectedChapter, onSelectChapter,
  jlptRange, onLevelPress,
  scriptLength, onLengthChange,
  wordFrequency, onFrequencyChange,
  error, onGenerate,
}: {
  vocabFilters: VocabFilter[];
  onToggleFilter: (f: VocabFilter) => void;
  chapters: ChapterOption[];
  selectedChapter: number | 'all';
  onSelectChapter: (c: number | 'all') => void;
  jlptRange: [number, number];
  onLevelPress: (idx: number) => void;
  scriptLength: ScriptLength;
  onLengthChange: (l: ScriptLength) => void;
  wordFrequency: WordFrequency;
  onFrequencyChange: (f: WordFrequency) => void;
  error: string | null;
  onGenerate: () => void;
}) {
  const [start, end] = jlptRange;

  return (
    <ScrollView contentContainerStyle={styles.configContent} showsVerticalScrollIndicator={false}>

      {/* ── 1. Vocab Status ──────────────────────────────── */}
      <SectionCard title="Word Status" emoji="📖">
        <Text style={styles.sectionDesc}>Which words to base the script on?</Text>
        <View style={styles.row}>
          {(['studying', 'studied'] as VocabFilter[]).map((f) => {
            const active = vocabFilters.includes(f);
            const color = f === 'studying' ? COLORS.studying : COLORS.studied;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => onToggleFilter(f)}
                style={[styles.filterChip, active && { borderColor: color, backgroundColor: `${color}15` }]}
              >
                <Text style={styles.filterEmoji}>{f === 'studying' ? '✏️' : '✅'}</Text>
                <Text style={[styles.filterText, active && { color }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* ── 2. Chapter / Category ────────────────────────── */}
      <SectionCard title="Vocabulary Category" emoji="🗂️">
        <Text style={styles.sectionDesc}>Browse by chapter or use all words.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chapterScroll}>
          <TouchableOpacity
            onPress={() => onSelectChapter('all')}
            style={[styles.chapterChip, selectedChapter === 'all' && styles.chapterChipActive]}
          >
            <Text style={[styles.chapterChipText, selectedChapter === 'all' && styles.chapterChipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {chapters.map((ch) => (
            <TouchableOpacity
              key={ch.chapter}
              onPress={() => onSelectChapter(ch.chapter)}
              style={[styles.chapterChip, selectedChapter === ch.chapter && styles.chapterChipActive]}
            >
              <Text style={[styles.chapterChipNum, selectedChapter === ch.chapter && { color: COLORS.primary }]}>
                Ch.{ch.chapter}
              </Text>
              <Text
                style={[styles.chapterChipText, selectedChapter === ch.chapter && styles.chapterChipTextActive]}
                numberOfLines={1}
              >
                {ch.chapter_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SectionCard>

      {/* ── 3. Word Frequency ────────────────────────────── */}
      <SectionCard title="Vocab Frequency" emoji="🔁">
        <Text style={styles.sectionDesc}>How often should your selected words appear?</Text>
        <View style={styles.row}>
          {FREQUENCY_OPTIONS.map((opt) => {
            const active = wordFrequency === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onFrequencyChange(opt.value)}
                style={[styles.freqBtn, active && { borderColor: opt.color, backgroundColor: `${opt.color}18` }]}
              >
                <Text style={[styles.freqLabel, active && { color: opt.color }]}>{opt.label}</Text>
                <Text style={styles.freqSub}>{opt.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SectionCard>

      {/* ── 4. JLPT Level ────────────────────────────────── */}
      <SectionCard title="JLPT Level" emoji="🎯">
        <Text style={styles.sectionDesc}>Tap a level. Tap adjacent to extend range.</Text>
        <View style={styles.jlptRail}>
          {JLPT_LEVELS.map((level, idx) => {
            const inRange = idx >= start && idx <= end;
            const isEdge = idx === start || idx === end;
            return (
              <TouchableOpacity
                key={level}
                onPress={() => onLevelPress(idx)}
                style={[styles.jlptBtn, inRange && styles.jlptBtnActive, isEdge && inRange && styles.jlptBtnEdge]}
                activeOpacity={0.75}
              >
                <Text style={[styles.jlptText, inRange && styles.jlptTextActive]}>{level}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.jlptSelected}>
          {start === end ? `${JLPT_LEVELS[start]} only` : `${JLPT_LEVELS[start]} → ${JLPT_LEVELS[end]}`}
        </Text>
      </SectionCard>

      {/* ── 5. Length ────────────────────────────────────── */}
      <SectionCard title="Script Length" emoji="📏">
        <View style={styles.row}>
          {LENGTH_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onLengthChange(opt.value)}
              style={[styles.lengthBtn, scriptLength === opt.value && styles.lengthBtnActive]}
            >
              <Text style={[styles.lengthLabel, scriptLength === opt.value && styles.lengthLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.lengthSub}>{opt.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SectionCard>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <TouchableOpacity onPress={onGenerate} style={styles.generateBtn} activeOpacity={0.85}>
        <Text style={styles.generateBtnText}>🎙️ Generate Audio</Text>
      </TouchableOpacity>

      <View style={{ height: SPACING.xxxl }} />
    </ScrollView>
  );
}

// ── Generating Step ────────────────────────────────────────────────────────────

function GeneratingStep({ message }: { message: string }) {
  const pulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.generatingContainer}>
      <Animated.View style={[styles.generatingOrb, { opacity: pulse }]} />
      <Text style={styles.generatingEmoji}>🎌</Text>
      <Text style={styles.generatingTitle}>Creating your lesson</Text>
      <Text style={styles.generatingMsg}>{message}</Text>
      <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
    </View>
  );
}

// ── Player Step ────────────────────────────────────────────────────────────────

function PlayerStep({
  script, player, status, onRegenerate,
}: {
  script: GeneratedScript;
  player: any;
  status: any;
  onRegenerate: () => void;
}) {
  const isPlaying = status?.playing ?? false;
  const currentTime = status?.currentTime ?? 0;
  const duration = status?.duration ?? 0;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.playerScroll} contentContainerStyle={styles.playerContent} showsVerticalScrollIndicator={false}>

        {/* ── Script: sentences with translations ─── */}
        <View style={styles.scriptCard}>
          <Text style={styles.scriptCardLabel}>Japanese Script</Text>
          {script.sentences.map((s, i) => (
            <View key={i} style={styles.sentenceBlock}>
              <Text style={styles.sentenceJa}>{s.ja}</Text>
              {s.en ? <Text style={styles.sentenceEn}>{s.en}</Text> : null}
            </View>
          ))}
        </View>

        {/* ── Vocabulary used ────────────────────── */}
        {script.usedWords.length > 0 && (
          <View style={styles.meaningsCard}>
            <Text style={styles.meaningsTitle}>📖 Vocabulary Used</Text>
            {script.usedWords.map((w, i) => (
              <View key={i} style={styles.meaningRow}>
                <View style={styles.meaningLeft}>
                  <Text style={styles.meaningWord}>{w.word}</Text>
                  <Text style={styles.meaningReading}>{w.reading}</Text>
                </View>
                <Text style={styles.meaningDef} numberOfLines={2}>{w.meaning}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 150 }} />
      </ScrollView>

      {/* ── Floating player controls ───────────── */}
      <View style={styles.playerControls}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
        <View style={styles.controlRow}>
          <TouchableOpacity onPress={onRegenerate} style={styles.sideBtn}>
            <Text style={styles.sideBtnText}>↺ New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => isPlaying ? player.pause() : player.play()}
            style={styles.playBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.playBtnIcon}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => player.seekTo(0)} style={styles.sideBtn}>
            <Text style={styles.sideBtnText}>↩ Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <Text style={styles.sectionCardEmoji}>{emoji}</Text>
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { paddingVertical: SPACING.xs, paddingRight: SPACING.md },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
  title: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  settingsBtn: { padding: SPACING.xs },
  settingsIcon: { fontSize: 22 },

  // Configure
  configContent: { padding: SPACING.xl },
  sectionCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionCardEmoji: { fontSize: 20 },
  sectionCardTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text },
  sectionDesc: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 18 },

  row: { flexDirection: 'row', gap: SPACING.sm },

  // Status chips
  filterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border,
  },
  filterEmoji: { fontSize: 16 },
  filterText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold, color: COLORS.textMuted },

  // Chapter horizontal scroll
  chapterScroll: { marginTop: SPACING.xs },
  chapterChip: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border,
    marginRight: SPACING.sm, alignItems: 'center',
  },
  chapterChipActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  chapterChipNum: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, fontWeight: FONTS.weights.bold },
  chapterChipText: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, fontWeight: FONTS.weights.medium },
  chapterChipTextActive: { color: COLORS.primary, fontWeight: FONTS.weights.bold },

  // Frequency
  freqBtn: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center',
    backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border, gap: 2,
  },
  freqLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textMuted },
  freqSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, textAlign: 'center' },

  // JLPT
  jlptRail: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  jlptBtn: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center',
    backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border,
  },
  jlptBtnActive: { backgroundColor: COLORS.primaryMuted, borderColor: COLORS.primary },
  jlptBtnEdge: { backgroundColor: COLORS.primary },
  jlptText: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textMuted },
  jlptTextActive: { color: COLORS.primary },
  jlptSelected: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary, marginTop: SPACING.xs },

  // Length
  lengthBtn: {
    flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, alignItems: 'center',
    backgroundColor: COLORS.bgInput, borderWidth: 1.5, borderColor: COLORS.border, gap: 2,
  },
  lengthBtnActive: { backgroundColor: COLORS.accentMuted, borderColor: COLORS.accent },
  lengthLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.textMuted },
  lengthLabelActive: { color: COLORS.accent },
  lengthSub: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  // Error & generate
  errorBox: {
    backgroundColor: `${COLORS.accent}18`, borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: `${COLORS.accent}40`, marginBottom: SPACING.md,
  },
  errorText: { color: COLORS.accent, fontSize: FONTS.sizes.sm, lineHeight: 20 },
  generateBtn: {
    backgroundColor: COLORS.jpRed, borderRadius: RADIUS.xl, paddingVertical: SPACING.lg,
    alignItems: 'center', ...SHADOWS.card, shadowColor: COLORS.jpRed,
  },
  generateBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.heavy, letterSpacing: 0.3 },

  // Generating
  generatingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxxl, gap: SPACING.lg,
  },
  generatingOrb: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: COLORS.primaryMuted,
  },
  generatingEmoji: { fontSize: 56 },
  generatingTitle: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.heavy, color: COLORS.text, textAlign: 'center' },
  generatingMsg: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Player
  playerScroll: { flex: 1 },
  playerContent: { padding: SPACING.xl },
  scriptCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  scriptCardLabel: {
    fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: FONTS.weights.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.md,
  },
  sentenceBlock: {
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sentenceJa: {
    fontSize: 20,
    color: COLORS.text,
    lineHeight: 34,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  sentenceEn: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Meanings
  meaningsCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md, ...SHADOWS.card,
  },
  meaningsTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: SPACING.sm },
  meaningRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  meaningLeft: { minWidth: 80 },
  meaningWord: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.text },
  meaningReading: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: 2 },
  meaningDef: { flex: 1, fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 18 },

  // Controls
  playerControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard, borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.xl, paddingBottom: SPACING.xxl, ...SHADOWS.strong,
  },
  progressBg: {
    height: 4, backgroundColor: COLORS.border, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: SPACING.xs,
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md },
  timeText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', ...SHADOWS.card,
  },
  playBtnIcon: { fontSize: 26, color: '#fff' },
  sideBtn: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgElevated, borderWidth: 1, borderColor: COLORS.border,
  },
  sideBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
});
