import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { Vocabulary, VocabRow, VocabStatus, QuizQuestion } from '../../../src/types';
import { rowToVocab } from '../../../src/stores/vocabStore';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../../src/constants/colors';
import { ProgressBar } from '../../../src/components/ProgressBar';

interface QuizAnswer {
  vocabId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuestion(vocab: Vocabulary, allVocab: Vocabulary[]): QuizQuestion {
  const correctAnswer = vocab.meaning;
  const distractors = shuffle(allVocab.filter((v) => v.id !== vocab.id))
    .slice(0, 3)
    .map((v) => v.meaning);
  const options = shuffle([correctAnswer, ...distractors]);
  return { vocab, options, correctAnswer };
}

export default function QuizSessionScreen() {
  const { statusFilter, questionCount, chapterId } = useLocalSearchParams<{
    statusFilter: string;
    questionCount: string;
    chapterId?: string;
  }>();
  const { user } = useAuthStore();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    buildQuiz();
  }, []);

  const buildQuiz = async () => {
    if (!user) return;

    const statuses: VocabStatus[] =
      statusFilter === 'both'
        ? ['studying', 'studied']
        : [statusFilter as VocabStatus];

    // Step 1: Fetch all vocabulary (or just the chapter) for question pool + distractors
    let vocabQuery = supabase.from('vocabulary').select('*');
    if (chapterId) {
      vocabQuery = vocabQuery.eq('chapter', parseInt(chapterId, 10));
    }
    const { data: allVocabData } = await vocabQuery;
    const allVocab = (allVocabData ?? []).map((r: VocabRow) => rowToVocab(r));

    if (allVocab.length < 4) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    // Step 2: Build the quiz word set from user_vocab_status DB (if exists),
    //         otherwise fall back to the in-memory statusMap from the store
    let quizKeySet: Set<string>;

    const { data: statusRows, error: statusErr } = await supabase
      .from('user_vocab_status')
      .select('chapter, section, no')
      .eq('user_id', user.id)
      .in('status', statuses);

    if (!statusErr && statusRows && statusRows.length > 0) {
      // Use DB data
      quizKeySet = new Set(
        statusRows.map((r: { chapter: number; section: number; no: number }) =>
          `${r.chapter}_${r.section}_${r.no}`
        )
      );
      // Filter by chapter if needed
      if (chapterId) {
        const ch = parseInt(chapterId, 10);
        quizKeySet = new Set(
          [...quizKeySet].filter((k) => k.startsWith(`${ch}_`))
        );
      }
    } else {
      // Fall back: use in-memory statusMap
      const { useVocabStore } = require('../../../src/stores/vocabStore');
      const { statusMap: localMap } = useVocabStore.getState();
      quizKeySet = new Set(
        Object.entries(localMap)
          .filter(([compositeId, s]) => {
            if (!statuses.includes(s as VocabStatus)) return false;
            if (chapterId) return compositeId.startsWith(`${chapterId}_`);
            return true;
          })
          .map(([id]) => id)
      );
    }

    if (quizKeySet.size === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    // Step 3: Filter vocab to only marked words
    const quizVocab = allVocab.filter((v) => quizKeySet.has(v.id));
    const shuffled = shuffle(quizVocab);
    const limit = questionCount === 'all' ? shuffled.length : parseInt(questionCount ?? '10');
    const selected = shuffled.slice(0, limit);

    // Use full vocab pool as distractors so MCQ has 4 options
    const distractorPool = allVocab.length >= 4 ? allVocab : quizVocab;
    setQuestions(selected.map((v) => buildQuestion(v, distractorPool)));
    setLoading(false);
  };

  const current = questions[currentIndex];

  const handleOptionPress = (option: string) => {
    if (revealed) return;
    setSelectedOption(option);
    setRevealed(true);
  };

  const handleNext = async () => {
    if (!selectedOption || !current) return;

    const answer: QuizAnswer = {
      vocabId: String(current.vocab.id),
      userAnswer: selectedOption,
      correctAnswer: current.correctAnswer,
      isCorrect: selectedOption === current.correctAnswer,
    };

    const newAnswers = [...answers, answer];

    if (currentIndex < questions.length - 1) {
      // Animate out/in
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();

      setAnswers(newAnswers);
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setRevealed(false);
    } else {
      // Quiz complete — save to Supabase
      await saveSession(newAnswers);
    }
  };

  const saveSession = async (finalAnswers: QuizAnswer[]) => {
    if (!user) return;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const correctCount = finalAnswers.filter((a) => a.isCorrect).length;

    const { data: sessionData } = await supabase
      .from('quiz_sessions')
      .insert({
        user_id: user.id,
        total_questions: finalAnswers.length,
        correct_answers: correctCount,
        duration_seconds: durationSeconds,
        source_filter: { statusFilter, chapterId: chapterId ?? null },
      })
      .select()
      .single();

    if (sessionData) {
      await supabase.from('quiz_answers').insert(
        finalAnswers.map((a) => ({
          session_id: sessionData.id,
          vocab_id: a.vocabId,
          user_answer: a.userAnswer,
          correct_answer: a.correctAnswer,
          is_correct: a.isCorrect,
        }))
      );
    }

    router.replace({
      pathname: '/(tabs)/quiz/results',
      params: {
        total: String(finalAnswers.length),
        correct: String(correctCount),
        duration: String(durationSeconds),
        sessionId: sessionData?.id ?? '',
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!current) return null;

  const progress = (currentIndex + (revealed ? 1 : 0)) / questions.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
          <Text style={styles.exitText}>✕ Exit</Text>
        </TouchableOpacity>
        <Text style={styles.counter}>
          {currentIndex + 1} / {questions.length}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <ProgressBar progress={progress} color={COLORS.primary} height={6} />
      </View>

      {/* Score so far */}
      <View style={styles.scoreRow}>
        <Text style={[styles.scorePill, { color: COLORS.studied }]}>
          ✓ {answers.filter((a) => a.isCorrect).length}
        </Text>
        <Text style={[styles.scorePill, { color: COLORS.accent }]}>
          ✗ {answers.filter((a) => !a.isCorrect).length}
        </Text>
      </View>

      {/* Question card */}
      <Animated.View style={[styles.questionCard, { opacity: fadeAnim }]}>
        <Text style={styles.questionHint}>What does this mean?</Text>
        <Text style={styles.japaneseWord}>{current.vocab.word}</Text>
        <Text style={styles.reading}>{current.vocab.reading}</Text>
      </Animated.View>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {current.options.map((option, idx) => {
          let optStyle = styles.optionBtn;
          let textStyle = styles.optionText;

          if (revealed) {
            if (option === current.correctAnswer) {
              optStyle = { ...optStyle, ...styles.optionCorrect };
              textStyle = { ...textStyle, color: COLORS.correct };
            } else if (option === selectedOption) {
              optStyle = { ...optStyle, ...styles.optionWrong };
              textStyle = { ...textStyle, color: COLORS.incorrect };
            } else {
              optStyle = { ...optStyle, opacity: 0.4 } as any;
            }
          }

          return (
            <TouchableOpacity
              key={idx}
              style={optStyle}
              onPress={() => handleOptionPress(option)}
              activeOpacity={revealed ? 1 : 0.8}
            >
              <Text style={styles.optionLetter}>
                {String.fromCharCode(65 + idx)}
              </Text>
              <Text style={[textStyle, { flex: 1 }]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Example (shown after reveal) */}
      {revealed && current.vocab.example_jp ? (
        <View style={styles.exampleBox}>
          <Text style={styles.exampleJp}>{current.vocab.example_jp}</Text>
          <Text style={styles.exampleEn}>{current.vocab.example_en}</Text>
        </View>
      ) : null}

      {/* Next button */}
      {revealed && (
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {currentIndex < questions.length - 1 ? 'Next →' : 'See Results 🎉'}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.xl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  exitBtn: { padding: SPACING.sm },
  exitText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm },
  counter: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textSecondary },
  progressContainer: { marginBottom: SPACING.sm },
  scoreRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.xl, justifyContent: 'center' },
  scorePill: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  questionCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xxl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  questionHint: { fontSize: FONTS.sizes.sm, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  japaneseWord: { fontSize: FONTS.sizes.japaneseXl, fontWeight: FONTS.weights.heavy, color: COLORS.text, letterSpacing: 3 },
  reading: { fontSize: FONTS.sizes.lg, color: COLORS.primary, fontWeight: FONTS.weights.medium },
  optionsContainer: { gap: SPACING.md, marginBottom: SPACING.md },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionCorrect: { backgroundColor: COLORS.correctMuted, borderColor: COLORS.correct },
  optionWrong: { backgroundColor: COLORS.incorrectMuted, borderColor: COLORS.incorrect },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bgElevated,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textSecondary,
  },
  optionText: { fontSize: FONTS.sizes.md, color: COLORS.text, fontWeight: FONTS.weights.medium },
  exampleBox: {
    backgroundColor: COLORS.primaryMuted,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  exampleJp: { fontSize: FONTS.sizes.md, color: COLORS.text, lineHeight: 22 },
  exampleEn: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontStyle: 'italic' },
  nextBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  nextText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
});
