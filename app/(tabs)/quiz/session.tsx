import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../src/lib/supabase';
import { useAuthStore } from '../../../src/stores/authStore';
import { Vocabulary, VocabRow, VocabStatus, QuizQuestion } from '../../../src/types';
import { rowToVocab } from '../../../src/stores/vocabStore';
import { useColors } from '../../../src/hooks/useColors';
import { FONTS, RADIUS, SHADOWS, SPACING, type ThemeColors } from '../../../src/constants/colors';
import { ProgressBar } from '../../../src/components/ProgressBar';

interface QuizAnswer {
  vocabId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function QuizSessionScreen() {
  const { source, chapters, categories, status, count } = useLocalSearchParams<{
    source?: string;
    chapters?: string;
    categories?: string;
    status: string;
    count: string;
  }>();
  const { user } = useAuthStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const startTime = useRef(Date.now());

  useEffect(() => {
    generateQuiz();
  }, [source, chapters, categories, status, count]);

  const generateQuiz = async () => {
    setLoading(true);

    if (source === 'general') {
      // ── General Words Mode ──
      const { data: gwData } = await supabase
        .from('general_words')
        .select('*');

      if (!gwData || gwData.length === 0) {
        setLoading(false);
        return;
      }

      const { statusMap: gwStatusMap } = (await import('../../../src/stores/generalWordStore')).useGeneralWordStore.getState();
      const catList = (categories || 'All').split(',');
      const isAllCat = catList.includes('All');

      let pool = gwData
        .filter((w: any) => {
          const catMatch = isAllCat || catList.includes(w.category || 'General');
          if (!catMatch) return false;
          const st = gwStatusMap[w.id] || 'unread';
          if (status === 'both') return st === 'studied' || st === 'studying';
          return st === status;
        })
        .map((w: any) => ({
          id: w.id,
          word: w.word_japanese,
          reading: w.word_hiragana,
          meaning: w.word_english,
        }));

      pool.sort(() => Math.random() - 0.5);

      if (count !== 'all') {
        const c = parseInt(count, 10);
        pool = pool.slice(0, c);
      }

      const allMeanings = Array.from(new Set(gwData.map((r: any) => r.word_english))).filter(Boolean);

      const qs: QuizQuestion[] = pool.map((v) => {
        const opts = [v.meaning];
        while (opts.length < 4 && opts.length < allMeanings.length) {
          const rand = allMeanings[Math.floor(Math.random() * allMeanings.length)];
          if (!opts.includes(rand)) opts.push(rand);
        }
        opts.sort(() => Math.random() - 0.5);
        return {
          vocabId: String(v.id),
          word: v.word,
          reading: v.reading,
          correctAnswer: v.meaning,
          options: opts,
        };
      });

      setQuestions(qs);
      setLoading(false);
      slideIn();
      return;
    }

    // ── Chapter Vocabulary Mode ──
    const chArray = (chapters || '').split(',').map(Number).filter((n) => !isNaN(n));

    let query = supabase.from('vocabulary').select('*');
    if (chArray.length > 0) {
      query = query.in('chapter', chArray);
    }
    const { data } = await query;

    if (!data || data.length === 0) {
      setLoading(false);
      return;
    }

    const { statusMap } = (await import('../../../src/stores/vocabStore')).useVocabStore.getState();

    let pool = (data as VocabRow[]).map(rowToVocab).filter((v) => {
      const st = statusMap[String(v.id)] || 'unread';
      if (status === 'both') return st === 'studied' || st === 'studying';
      return st === status;
    });

    pool.sort(() => Math.random() - 0.5);

    if (count !== 'all') {
      const c = parseInt(count, 10);
      pool = pool.slice(0, c);
    }

    const allMeanings = Array.from(new Set((data as VocabRow[]).map((r) => r.meaning)));

    const qs: QuizQuestion[] = pool.map((v) => {
      const opts = [v.meaning];
      while (opts.length < 4 && opts.length < allMeanings.length) {
        const rand = allMeanings[Math.floor(Math.random() * allMeanings.length)];
        if (!opts.includes(rand)) opts.push(rand);
      }
      opts.sort(() => Math.random() - 0.5);
      return {
        vocabId: String(v.id),
        word: v.word,
        reading: v.reading,
        correctAnswer: v.meaning,
        options: opts,
      };
    });

    setQuestions(qs);
    setLoading(false);
    slideIn();
  };

  const slideIn = () => {
    slideAnim.setValue(50);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  };

  const handleSelect = (opt: string) => {
    if (showResult) return;
    setSelectedOption(opt);
    setShowResult(true);

    const q = questions[currentIndex];
    const isCorrect = opt === q.correctAnswer;

    setAnswers((prev) => [
      ...prev,
      { vocabId: q.vocabId, userAnswer: opt, correctAnswer: q.correctAnswer, isCorrect },
    ]);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setSelectedOption(null);
      setShowResult(false);
      setCurrentIndex((prev) => prev + 1);
      slideIn();
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const duration = Math.round((Date.now() - startTime.current) / 1000);

    router.replace({
      pathname: '/(tabs)/quiz/results',
      params: {
        total: questions.length.toString(),
        correct: correctCount.toString(),
        duration: duration.toString(),
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.errorText}>No questions could be generated.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.back()}>
          <Text style={s.btnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const q = questions[currentIndex];
  const progress = (currentIndex + 1) / questions.length;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <View style={s.progressWrap}>
          <ProgressBar progress={progress} height={8} />
          <Text style={s.progressText}>{currentIndex + 1} / {questions.length}</Text>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={s.content}
        style={{ transform: [{ translateY: slideAnim }] }}
      >
        <View style={s.card}>
          <Text style={s.word}>{q.word}</Text>
          <Text style={s.reading}>{q.reading}</Text>
        </View>

        <View style={s.options}>
          {q.options.map((opt, i) => {
            const isSelected = selectedOption === opt;
            const isCorrectAnswer = opt === q.correctAnswer;

            let btnStyle: any = s.optBtn;
            let textStyle: any = s.optText;

            if (showResult) {
              if (isCorrectAnswer) {
                btnStyle = [s.optBtn, s.optBtnCorrect];
                textStyle = [s.optText, s.optTextCorrect];
              } else if (isSelected) {
                btnStyle = [s.optBtn, s.optBtnWrong];
                textStyle = [s.optText, s.optTextWrong];
              }
            } else if (isSelected) {
              btnStyle = [s.optBtn, s.optBtnSelected];
            }

            return (
              <TouchableOpacity
                key={i}
                style={btnStyle}
                onPress={() => handleSelect(opt)}
                disabled={showResult}
                activeOpacity={0.7}
              >
                <Text style={textStyle}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showResult && (
          <TouchableOpacity
            style={s.nextBtn}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={s.nextBtnText}>
              {currentIndex < questions.length - 1 ? 'Next' : 'Finish'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    errorText: { fontSize: FONTS.sizes.md, color: C.text, marginBottom: SPACING.md },
    btn: { padding: SPACING.md, backgroundColor: C.primaryMuted, borderRadius: RADIUS.md },
    btnText: { color: C.primary, fontWeight: FONTS.weights.bold },
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.xl,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      gap: SPACING.md,
    },
    closeBtn: { padding: 4 },
    closeText: { fontSize: 20, color: C.textMuted },
    progressWrap: { flex: 1, gap: SPACING.xs },
    progressText: { fontSize: 10, color: C.textMuted, textAlign: 'right', fontWeight: FONTS.weights.bold },
    content: { padding: SPACING.xl, paddingBottom: 100 },
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xxxl,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: SPACING.xxl,
      minHeight: 200,
      ...SHADOWS.card,
    },
    word: { fontSize: 42, fontWeight: FONTS.weights.heavy, color: C.text, marginBottom: SPACING.sm, textAlign: 'center' },
    reading: { fontSize: FONTS.sizes.lg, color: C.primary, fontWeight: FONTS.weights.semibold },
    options: { gap: SPACING.md },
    optBtn: {
      backgroundColor: C.bgCard,
      borderWidth: 2,
      borderColor: C.border,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
    },
    optBtnSelected: { borderColor: C.primary, backgroundColor: C.primaryMuted },
    optBtnCorrect: { borderColor: C.studied, backgroundColor: C.studiedMuted },
    optBtnWrong: { borderColor: '#FF4D4D', backgroundColor: 'rgba(255,77,77,0.1)' },
    optText: { fontSize: FONTS.sizes.md, color: C.text, fontWeight: FONTS.weights.medium, textAlign: 'center' },
    optTextCorrect: { color: C.studied, fontWeight: FONTS.weights.bold },
    optTextWrong: { color: '#FF4D4D' },
    nextBtn: {
      marginTop: SPACING.xxl,
      backgroundColor: C.primary,
      padding: SPACING.lg,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      ...SHADOWS.card,
    },
    nextBtnText: { color: '#fff', fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold },
  });
}
