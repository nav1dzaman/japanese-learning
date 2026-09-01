import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { GeneralWord, GeneralWordStatus } from '../types';
import { useColors } from '../hooks/useColors';
import { useSettingsStore } from '../stores/settingsStore';
import { synthesizeSpeech } from '../lib/tts';
import { FuriganaText } from './FuriganaText';
import { FONTS, RADIUS, SPACING, type ThemeColors } from '../constants/colors';

interface GeneralWordCardProps {
  word: GeneralWord;
  status: GeneralWordStatus;
  onStatusChange: (status: GeneralWordStatus) => void;
  onDelete?: () => void;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  verb: { bg: 'rgba(124, 106, 247, 0.15)', border: '#7C6AF7', text: '#9B8DFF' },
  noun: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3B82F6', text: '#60A5FA' },
  adjective: { bg: 'rgba(242, 95, 142, 0.15)', border: '#F25F8E', text: '#F472B6' },
  adverb: { bg: 'rgba(245, 166, 35, 0.15)', border: '#F5A623', text: '#FBBF24' },
  particle: { bg: 'rgba(20, 184, 166, 0.15)', border: '#14B8A6', text: '#2DD4BF' },
  expression: { bg: 'rgba(76, 175, 130, 0.15)', border: '#4CAF82', text: '#34D399' },
  other: { bg: 'rgba(107, 114, 128, 0.15)', border: '#6B7280', text: '#9CA3AF' },
};

export function GeneralWordCard({
  word,
  status,
  onStatusChange,
  onDelete,
}: GeneralWordCardProps) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const settings = useSettingsStore();

  const [expanded, setExpanded] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);

  const STATUS_CONFIG: Record<
    GeneralWordStatus,
    { emoji: string; label: string; color: string; bg: string; next: GeneralWordStatus }
  > = {
    unread: {
      emoji: '📖',
      label: 'Unread',
      color: C.textMuted,
      bg: C.bgElevated,
      next: 'studying',
    },
    studying: {
      emoji: '✏️',
      label: 'Studying',
      color: C.studying,
      bg: C.studyingMuted,
      next: 'studied',
    },
    studied: {
      emoji: '✅',
      label: 'Studied',
      color: C.studied,
      bg: C.studiedMuted,
      next: 'unread',
    },
  };

  const BORDER_COLORS: Record<GeneralWordStatus, string> = {
    unread: C.border,
    studying: C.studying,
    studied: C.studied,
  };

  const cfg = STATUS_CONFIG[status];
  const typeKey = (word.word_type || 'other').toLowerCase();
  const typeColors = TYPE_COLORS[typeKey] || TYPE_COLORS.other;

  const handleToggleExpand = () => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded((e) => !e);
  };

  const handlePlayAudio = async () => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      if (!audioUri) {
        const synth = await synthesizeSpeech(
          word.word_japanese,
          settings.inworldApiKey,
          settings.inworldModel || 'inworld-tts-2',
          settings.inworldVoice || 'Asuka'
        );
        setAudioUri(synth.fileUri);
      }
      player.play();
    } catch (err) {
      console.error('Audio playback error:', err);
    } finally {
      setTimeout(() => setPlayingAudio(false), 1500);
    }
  };

  const handleDeleteConfirm = () => {
    Alert.alert(
      'Delete Word',
      `Are you sure you want to remove "${word.word_japanese}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const chevronRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const isVerb = typeKey.includes('verb');
  const verbForms = word.verb_forms;
  const hasVerbForms = isVerb && verbForms && Object.keys(verbForms).length > 0;
  const hasExample = !!(word.sentence_japanese || word.sentence_english);

  return (
    <View style={[s.card, { borderLeftColor: BORDER_COLORS[status] }]}>
      {/* ── Top Row: Type & Category + Status Toggle ── */}
      <View style={s.headerRow}>
        <View style={s.tagsRow}>
          {/* Type chip */}
          <View
            style={[
              s.typePill,
              { backgroundColor: typeColors.bg, borderColor: typeColors.border },
            ]}
          >
            <Text style={[s.typePillText, { color: typeColors.text }]}>
              {word.word_type.toUpperCase()}
            </Text>
          </View>

          {/* Category pill */}
          {word.category ? (
            <View style={s.categoryPill}>
              <Text style={s.categoryText}>{word.category}</Text>
            </View>
          ) : null}
        </View>

        {/* 3-State Status button */}
        <TouchableOpacity
          style={[s.statusBtn, { backgroundColor: cfg.bg, borderColor: cfg.color }]}
          onPress={() => onStatusChange(cfg.next)}
          activeOpacity={0.7}
        >
          <Text style={s.statusEmoji}>{cfg.emoji}</Text>
          <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Main Word Section ── */}
      <View style={s.mainSection}>
        <View style={s.wordRow}>
          <Text style={s.japaneseWord} numberOfLines={2}>
            {word.word_japanese}
          </Text>

          {/* Audio pronounce button */}
          <TouchableOpacity
            onPress={handlePlayAudio}
            style={s.audioBtn}
            activeOpacity={0.7}
          >
            {playingAudio ? (
              <ActivityIndicator size="small" color={C.primary} />
            ) : (
              <Text style={s.audioEmoji}>🔊</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Reading and Romaji */}
        <View style={s.readingRow}>
          <Text style={s.hiraganaText}>{word.word_hiragana}</Text>
          <Text style={s.dotSep}>•</Text>
          <Text style={s.romajiText}>{word.word_romaji}</Text>
        </View>

        {/* English Meaning */}
        <Text style={s.meaningText}>{word.word_english}</Text>
      </View>

      {/* ── Expandable Details Trigger ── */}
      {(hasVerbForms || hasExample || onDelete) && (
        <TouchableOpacity
          style={s.expandBar}
          onPress={handleToggleExpand}
          activeOpacity={0.7}
        >
          <Text style={s.expandLabel}>
            {hasVerbForms ? 'Verb Forms & Sentences' : 'Example Sentence & Details'}
          </Text>
          <Animated.Text style={[s.chevron, { transform: [{ rotate: chevronRotate }] }]}>
            ▾
          </Animated.Text>
        </TouchableOpacity>
      )}

      {/* ── Expandable Content ── */}
      {expanded && (
        <View style={s.expandedSection}>
          {/* Verb Forms Table */}
          {hasVerbForms && (
            <View style={s.verbFormsBlock}>
              <Text style={s.sectionHeaderTitle}>Conjugation Forms</Text>
              <View style={s.formsGrid}>
                {verbForms?.nai && (
                  <FormItem label="Negative (ない)" value={verbForms.nai} C={C} s={s} />
                )}
                {verbForms?.te && (
                  <FormItem label="Te-form (て)" value={verbForms.te} C={C} s={s} />
                )}
                {verbForms?.potential && (
                  <FormItem label="Potential (可能)" value={verbForms.potential} C={C} s={s} />
                )}
                {verbForms?.volitional && (
                  <FormItem label="Volitional (意向)" value={verbForms.volitional} C={C} s={s} />
                )}
                {verbForms?.masu && (
                  <FormItem label="Polite (ます)" value={verbForms.masu} C={C} s={s} />
                )}
                {verbForms?.ta && (
                  <FormItem label="Past (た)" value={verbForms.ta} C={C} s={s} />
                )}
              </View>
            </View>
          )}

          {/* Example Sentence with Furigana */}
          {hasExample && (
            <View style={s.exampleBlock}>
              <Text style={s.sectionHeaderTitle}>Example Sentence</Text>
              {word.sentence_japanese ? (
                <View style={s.furiganaBox}>
                  <FuriganaText text={word.sentence_japanese} fontSize={16} />
                </View>
              ) : null}
              {word.sentence_english ? (
                <Text style={s.sentenceEnText}>{word.sentence_english}</Text>
              ) : null}
            </View>
          )}

          {/* Actions: Delete */}
          {onDelete && (
            <View style={s.cardActionsRow}>
              <TouchableOpacity
                onPress={handleDeleteConfirm}
                style={s.deleteBtn}
                activeOpacity={0.7}
              >
                <Text style={s.deleteBtnText}>🗑️ Delete Word</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function FormItem({
  label,
  value,
  C,
  s,
}: {
  label: string;
  value: string;
  C: ThemeColors;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.formItem}>
      <Text style={s.formLabel}>{label}</Text>
      <Text style={s.formValue}>{value}</Text>
    </View>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      borderLeftWidth: 4,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      padding: SPACING.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.xs,
    },
    tagsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    typePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      borderWidth: 0.8,
    },
    typePillText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    categoryPill: {
      backgroundColor: C.bgElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      borderWidth: 0.5,
      borderColor: C.border,
    },
    categoryText: {
      fontSize: 11,
      fontWeight: '500',
      color: C.textSecondary,
    },
    statusBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      gap: 4,
    },
    statusEmoji: {
      fontSize: 13,
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    mainSection: {
      marginTop: SPACING.xs,
    },
    wordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    japaneseWord: {
      fontSize: 24,
      fontWeight: '700',
      color: C.text,
      flex: 1,
      letterSpacing: 0.5,
    },
    audioBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: C.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.5,
      borderColor: C.border,
      marginLeft: SPACING.sm,
    },
    audioEmoji: {
      fontSize: 17,
    },
    readingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 2,
      marginBottom: 6,
    },
    hiraganaText: {
      fontSize: 14,
      fontWeight: '600',
      color: C.primaryLight,
    },
    dotSep: {
      marginHorizontal: 6,
      color: C.textMuted,
      fontSize: 12,
    },
    romajiText: {
      fontSize: 13,
      fontWeight: '400',
      color: C.textSecondary,
      fontStyle: 'italic',
    },
    meaningText: {
      fontSize: 15,
      fontWeight: '500',
      color: C.text,
      lineHeight: 20,
    },
    expandBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    expandLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textMuted,
    },
    chevron: {
      fontSize: 14,
      color: C.textMuted,
    },
    expandedSection: {
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
    },
    sectionHeaderTitle: {
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: C.textMuted,
      marginBottom: SPACING.xs,
    },
    verbFormsBlock: {
      marginBottom: SPACING.md,
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
    },
    formsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
    },
    formItem: {
      width: '48%',
      backgroundColor: C.bgCard,
      padding: SPACING.xs,
      borderRadius: RADIUS.sm,
      borderWidth: 0.5,
      borderColor: C.border,
    },
    formLabel: {
      fontSize: 10,
      color: C.textMuted,
      fontWeight: '600',
    },
    formValue: {
      fontSize: 13,
      fontWeight: '600',
      color: C.primaryLight,
      marginTop: 2,
    },
    exampleBlock: {
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    furiganaBox: {
      paddingVertical: 4,
    },
    sentenceEnText: {
      fontSize: 13,
      color: C.textSecondary,
      fontStyle: 'italic',
      marginTop: 4,
      lineHeight: 18,
    },
    cardActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    deleteBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: RADIUS.sm,
      backgroundColor: 'rgba(242, 95, 142, 0.1)',
    },
    deleteBtnText: {
      fontSize: 12,
      color: C.accent,
      fontWeight: '600',
    },
  });
}
