import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { COLORS, FONTS, RADIUS, SPACING, SHADOWS } from '../../src/constants/colors';

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Study Book</Text>
            <Text style={styles.subtitle}>Your daily learning journal</Text>
          </View>
          <Text style={styles.headerEmoji}>📔</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          {/* ── Today's Note ─────────────────────────────── */}
          <View style={styles.todayCard}>
            {/* Date badge */}
            <View style={styles.todayDateRow}>
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeDay}>{dayOfWeek(todayISO())}</Text>
                <Text style={styles.todayBadgeNum}>{new Date().getDate()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayLabel}>TODAY</Text>
                <Text style={styles.todayFullDate}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
              </View>
              {/* Save button */}
              <TouchableOpacity
                onPress={handleManualSave}
                style={[styles.saveBtn, saveLabel === 'saved' && styles.saveBtnDone]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text style={[styles.saveBtnText, saveLabel === 'saved' && styles.saveBtnTextDone]}>
                    {saveLabel === 'saved' ? '✓ Saved' : '💾 Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Text input */}
            <TextInput
              style={styles.noteInput}
              value={todayContent}
              onChangeText={handleTextChange}
              placeholder={"What did you study today? \n\n• New words learned\n• Grammar points\n• How the session went..."}
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />

            {todayContent.length > 0 && (
              <Text style={styles.charCount}>{todayContent.length} characters</Text>
            )}
          </View>

          {/* ── Past Notes ───────────────────────────────── */}
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xxl }} />
          ) : pastNotes.length === 0 ? (
            <View style={styles.emptyPast}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyText}>No previous entries yet</Text>
              <Text style={styles.emptySubtext}>Start writing today — your entries will appear here tomorrow!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.pastHeading}>Previous Entries</Text>
              {pastNotes.map((note) => (
                <PastNoteCard key={note.id} note={note} />
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

function PastNoteCard({ note }: { note: StudyNote }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = note.content.length > 200;
  const displayContent = !expanded && isLong
    ? note.content.slice(0, 200) + '…'
    : note.content;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => isLong && setExpanded((v) => !v)}
      style={styles.pastCard}
    >
      <View style={styles.pastCardTop}>
        {/* Date column */}
        <View style={styles.pastDateCol}>
          <Text style={styles.pastDay}>{dayOfWeek(note.note_date)}</Text>
          <Text style={styles.pastNum}>{new Date(note.note_date + 'T00:00:00').getDate()}</Text>
          <Text style={styles.pastMonth}>
            {new Date(note.note_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.pastDivider} />

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text style={styles.pastDateLabel}>{formatDisplayDate(note.note_date)}</Text>
          <Text style={styles.pastContent}>{displayContent}</Text>
          {isLong && (
            <Text style={styles.expandBtn}>{expanded ? '▲ Show less' : '▼ Show more'}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: FONTS.sizes.xxl, fontWeight: FONTS.weights.heavy, color: COLORS.text },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  headerEmoji: { fontSize: 36 },

  content: { padding: SPACING.xl },

  // Today card
  todayCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
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
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBadgeDay: { fontSize: FONTS.sizes.xs, color: 'rgba(255,255,255,0.8)', fontWeight: FONTS.weights.semibold },
  todayBadgeNum: { fontSize: FONTS.sizes.xl, color: '#fff', fontWeight: FONTS.weights.heavy, lineHeight: 26 },
  todayLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.heavy,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  todayFullDate: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  saveBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnDone: { backgroundColor: COLORS.studiedMuted, borderColor: COLORS.studied },
  saveBtnText: { fontSize: FONTS.sizes.sm, color: COLORS.primary, fontWeight: FONTS.weights.semibold },
  saveBtnTextDone: { color: COLORS.studied },
  noteInput: {
    minHeight: 180,
    color: COLORS.text,
    fontSize: FONTS.sizes.md,
    lineHeight: 24,
    padding: SPACING.md,
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Past notes
  pastHeading: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  pastCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  pastCardTop: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  pastDateCol: { alignItems: 'center', minWidth: 36 },
  pastDay: { fontSize: FONTS.sizes.xs, color: COLORS.primary, fontWeight: FONTS.weights.bold },
  pastNum: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.heavy, color: COLORS.text, lineHeight: 28 },
  pastMonth: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },
  pastDivider: { width: 1, backgroundColor: COLORS.border, alignSelf: 'stretch', marginHorizontal: SPACING.xs },
  pastDateLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  pastContent: { fontSize: FONTS.sizes.sm, color: COLORS.text, lineHeight: 20 },
  expandBtn: { fontSize: FONTS.sizes.xs, color: COLORS.primary, marginTop: SPACING.sm, fontWeight: FONTS.weights.semibold },

  // Empty
  emptyPast: { alignItems: 'center', marginTop: SPACING.xxl, gap: SPACING.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FONTS.sizes.lg, color: COLORS.textSecondary, fontWeight: FONTS.weights.semibold },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 20,
  },
});
