import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { useColors } from '../../src/hooks/useColors';
import { FONTS, RADIUS, SPACING, SHADOWS, type ThemeColors } from '../../src/constants/colors';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudyNote {
  id: string;
  note_date: string; // ISO date string "YYYY-MM-DD"
  content: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function dayOfWeek(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function StudyBookScreen() {
  const { user } = useAuthStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [todayContent, setTodayContent] = useState('');
  const [todayId, setTodayId] = useState<string | null>(null);
  const [pastNotes, setPastNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'save' | 'saved'>('save');
  const [refreshing, setRefreshing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const today = todayISO();

    const { data, error } = await supabase
      .from('study_notes')
      .select('id, note_date, content, updated_at')
      .eq('user_id', user.id)
      .order('note_date', { ascending: false });

    if (error) {
      console.error('[StudyBook] fetch error:', error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (data ?? []) as StudyNote[];
    const todayRow = rows.find((r) => r.note_date === today);
    const past = rows.filter((r) => r.note_date !== today);

    if (todayRow) {
      setTodayId(todayRow.id);
      setTodayContent(todayRow.content);
    } else {
      setTodayId(null);
      setTodayContent('');
    }
    setPastNotes(past);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  // ── Save (upsert) ──────────────────────────────────────────────────────────

  const saveNote = useCallback(async (text: string) => {
    if (!user) return;
    setSaving(true);
    const today = todayISO();

    const { data, error } = await supabase
      .from('study_notes')
      .upsert(
        { user_id: user.id, note_date: today, content: text },
        { onConflict: 'user_id,note_date' }
      )
      .select('id')
      .single();

    if (!error && data) {
      setTodayId(data.id);
    }
    setSaving(false);
    setSaveLabel('saved');
    setTimeout(() => setSaveLabel('save'), 2000);
  }, [user]);

  // Auto-save with 1.5s debounce
  const handleTextChange = (text: string) => {
    setTodayContent(text);
    setSaveLabel('save');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(text), 1500);
  };

  const handleManualSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveNote(todayContent);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Study Book</Text>
            <Text style={s.subtitle}>Your daily learning journal</Text>
          </View>
          <Text style={s.headerEmoji}>📔</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        >
          {/* ── Today's Note ─────────────────────────────── */}
          <View style={s.todayCard}>
            {/* Date badge */}
            <View style={s.todayDateRow}>
              <View style={s.todayBadge}>
                <Text style={s.todayBadgeDay}>{dayOfWeek(todayISO())}</Text>
                <Text style={s.todayBadgeNum}>{new Date().getDate()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.todayLabel}>TODAY</Text>
                <Text style={s.todayFullDate}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              {/* Save button */}
              <TouchableOpacity
                onPress={handleManualSave}
                style={[s.saveBtn, saveLabel === 'saved' && s.saveBtnDone]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={C.primary} size="small" />
                ) : (
                  <Text style={[s.saveBtnText, saveLabel === 'saved' && s.saveBtnTextDone]}>
                    {saveLabel === 'saved' ? '✓ Saved' : '💾 Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Text input */}
            <TextInput
              style={s.noteInput}
              value={todayContent}
              onChangeText={handleTextChange}
              placeholder={"What did you study today? \n\n• New words learned\n• Grammar points\n• How the session went..."}
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {todayContent.length > 0 && (
              <Text style={s.charCount}>{todayContent.length} characters</Text>
            )}
          </View>

          {/* ── Past Notes ───────────────────────────────── */}
          {loading ? (
            <ActivityIndicator color={C.primary} style={{ marginTop: SPACING.xxl }} />
          ) : pastNotes.length === 0 ? (
            <View style={s.emptyPast}>
              <Text style={s.emptyEmoji}>📅</Text>
              <Text style={s.emptyText}>No previous entries yet</Text>
              <Text style={s.emptySubtext}>Start writing today — your entries will appear here tomorrow!</Text>
            </View>
          ) : (
            <>
              <Text style={s.pastHeading}>Previous Entries</Text>
              {pastNotes.map((note) => (
                <PastNoteCard key={note.id} note={note} C={C} s={s} />
              ))}
            </>
          )}

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Past Note Card ────────────────────────────────────────────────────────────

function PastNoteCard({ note, C, s }: { note: StudyNote; C: ThemeColors; s: ReturnType<typeof makeStyles> }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.content.length > 200;
  const displayContent = !expanded && isLong
    ? note.content.slice(0, 200) + '…'
    : note.content;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => isLong && setExpanded((v) => !v)}
      style={s.pastCard}
    >
      <View style={s.pastCardTop}>
        {/* Date column */}
        <View style={s.pastDateCol}>
          <Text style={s.pastDay}>{dayOfWeek(note.note_date)}</Text>
          <Text style={s.pastNum}>{new Date(note.note_date + 'T00:00:00').getDate()}</Text>
          <Text style={s.pastMonth}>
            {new Date(note.note_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
          </Text>
        </View>

        {/* Divider */}
        <View style={s.pastDivider} />

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text style={s.pastDateLabel}>{formatDisplayDate(note.note_date)}</Text>
          <Text style={s.pastContent}>{displayContent}</Text>
          {isLong && (
            <Text style={s.expandBtn}>{expanded ? '▲ Show less' : '▼ Show more'}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: C.text },
    subtitle: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
    headerEmoji: { fontSize: 36 },

    content: { padding: SPACING.xl },

    // Today card
    todayCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      marginBottom: SPACING.xl,
      borderWidth: 1,
      borderColor: C.borderActive,
      ...SHADOWS.card,
    },
    todayDateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    },
    todayBadge: {
      width: 52,
      height: 52,
      borderRadius: RADIUS.md,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayBadgeDay: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.weights.semibold },
    todayBadgeNum: { fontSize: FONTS.sizes.xl, color: '#fff', fontWeight: FONTS.weights.heavy, lineHeight: 26 },
    todayLabel: {
      fontSize: FONTS.sizes.xs,
      fontWeight: FONTS.weights.heavy,
      color: C.primary,
      letterSpacing: 1.5,
    },
    todayFullDate: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
    saveBtn: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: C.primaryMuted,
      borderWidth: 1,
      borderColor: C.borderActive,
      minWidth: 72,
      alignItems: 'center',
    },
    saveBtnDone: { backgroundColor: C.studiedMuted, borderColor: C.studied },
    saveBtnText: { fontSize: FONTS.sizes.sm, color: C.primary, fontWeight: FONTS.weights.semibold },
    saveBtnTextDone: { color: C.studied },
    noteInput: {
      minHeight: 180,
      color: C.text,
      fontSize: FONTS.sizes.md,
      lineHeight: 24,
      padding: SPACING.md,
      backgroundColor: C.bgInput,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
    },
    charCount: {
      fontSize: FONTS.sizes.xs,
      color: C.textMuted,
      textAlign: 'right',
      marginTop: SPACING.xs,
    },

    // Past notes
    pastHeading: {
      fontSize: FONTS.sizes.lg,
      fontWeight: FONTS.weights.bold,
      color: C.text,
      marginBottom: SPACING.md,
    },
    pastCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      marginBottom: SPACING.md,
      borderWidth: 1,
      borderColor: C.border,
      ...SHADOWS.card,
    },
    pastCardTop: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
    pastDateCol: { alignItems: 'center', minWidth: 36 },
    pastDay: { fontSize: FONTS.sizes.xs, color: C.primary, fontWeight: FONTS.weights.bold },
    pastNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.heavy, color: C.text, lineHeight: 28 },
    pastMonth: { fontSize: FONTS.sizes.xs, color: C.textMuted },
    pastDivider: { width: 1, backgroundColor: C.border, alignSelf: 'stretch', marginHorizontal: SPACING.xs },
    pastDateLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: C.textSecondary, marginBottom: SPACING.xs },
    pastContent: { fontSize: FONTS.sizes.sm, color: C.text, lineHeight: 20 },
    expandBtn: { fontSize: FONTS.sizes.xs, color: C.primary, marginTop: SPACING.sm, fontWeight: FONTS.weights.semibold },

    // Empty
    emptyPast: { alignItems: 'center', marginTop: SPACING.xxl, gap: SPACING.md },
    emptyEmoji: { fontSize: 48 },
    emptyText: { fontSize: FONTS.sizes.lg, color: C.textSecondary, fontWeight: FONTS.weights.semibold },
    emptySubtext: {
      fontSize: FONTS.sizes.sm,
      color: C.textMuted,
      textAlign: 'center',
      paddingHorizontal: SPACING.xl,
      lineHeight: 20,
    },
  });
}
