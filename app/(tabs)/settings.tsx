import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore, GROQ_MODELS, INWORLD_VOICES } from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { COLORS, FONTS, RADIUS, SPACING, SHADOWS } from '../../src/constants/colors';

export default function SettingsScreen() {
  const { groqApiKey, groqModel, inworldApiKey, inworldModel, inworldVoice, hydrate, update } =
    useSettingsStore();
  const { scheme, toggle: toggleTheme } = useThemeStore();
  const isDark = scheme === 'dark';

  const [localGroqKey, setLocalGroqKey] = useState(groqApiKey);
  const [localGroqModel, setLocalGroqModel] = useState(groqModel);
  const [localInworldKey, setLocalInworldKey] = useState(inworldApiKey);
  const [localInworldModel, setLocalInworldModel] = useState(inworldModel);
  const [localInworldVoice, setLocalInworldVoice] = useState(inworldVoice);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showInworldKey, setShowInworldKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    hydrate().then(() => {
      const s = useSettingsStore.getState();
      setLocalGroqKey(s.groqApiKey);
      setLocalGroqModel(s.groqModel);
      setLocalInworldKey(s.inworldApiKey);
      setLocalInworldModel(s.inworldModel);
      setLocalInworldVoice(s.inworldVoice);
    });
  }, []);

  const handleSave = async () => {
    await update({
      groqApiKey: localGroqKey.trim(),
      groqModel: localGroqModel,
      inworldApiKey: localInworldKey.trim(),
      inworldModel: localInworldModel,
      inworldVoice: localInworldVoice,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
          >
            <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Appearance Section ───────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🎨</Text>
            <View>
              <Text style={styles.sectionTitle}>Appearance</Text>
              <Text style={styles.sectionSub}>Switch between dark and light mode</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.themeToggleRow}>
              <View style={styles.themeOption}>
                <Text style={styles.themeOptionIcon}>🌙</Text>
                <Text style={[styles.themeOptionLabel, !isDark && styles.themeOptionInactive]}>Dark</Text>
              </View>

              {/* Toggle track */}
              <TouchableOpacity
                onPress={toggleTheme}
                activeOpacity={0.85}
                style={[styles.themeTrack, isDark ? styles.themeTrackDark : styles.themeTrackLight]}
              >
                <View style={[styles.themeThumb, isDark ? styles.themeThumbLeft : styles.themeThumbRight]} />
              </TouchableOpacity>

              <View style={styles.themeOption}>
                <Text style={styles.themeOptionIcon}>☀️</Text>
                <Text style={[styles.themeOptionLabel, isDark && styles.themeOptionInactive]}>Light</Text>
              </View>
            </View>
            <Text style={styles.hint}>
              Currently: {isDark ? '🌙 Dark mode' : '☀️ Light mode'}
            </Text>
          </View>

          {/* ── LLM Section ─────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🤖</Text>
            <View>
              <Text style={styles.sectionTitle}>LLM Model</Text>
              <Text style={styles.sectionSub}>Used to generate Japanese audio scripts</Text>
            </View>
          </View>

          <View style={styles.card}>
            <FieldLabel label="Groq API Key" />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={localGroqKey}
                onChangeText={setLocalGroqKey}
                placeholder="gsk_..."
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showGroqKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowGroqKey((v) => !v)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showGroqKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Get your key at console.groq.com</Text>

            <FieldLabel label="Model" style={{ marginTop: SPACING.lg }} />
            <View style={styles.chipRow}>
              {GROQ_MODELS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setLocalGroqModel(m.value)}
                  style={[
                    styles.chip,
                    localGroqModel === m.value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localGroqModel === m.value && styles.chipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Speech AI Section ────────────────────────── */}
          <View style={[styles.sectionHeader, { marginTop: SPACING.xxl }]}>
            <Text style={styles.sectionEmoji}>🔊</Text>
            <View>
              <Text style={styles.sectionTitle}>Speech AI</Text>
              <Text style={styles.sectionSub}>Inworld TTS — converts script to audio</Text>
            </View>
          </View>

          <View style={styles.card}>
            <FieldLabel label="Inworld API Key" />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={localInworldKey}
                onChangeText={setLocalInworldKey}
                placeholder="Basic key..."
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showInworldKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowInworldKey((v) => !v)}
                style={styles.eyeBtn}
              >
                <Text style={styles.eyeText}>{showInworldKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Pre-filled with default key. Get yours at inworld.ai</Text>

            <FieldLabel label="Model" style={{ marginTop: SPACING.lg }} />
            <View style={styles.chipRow}>
              {['inworld-tts-2', 'inworld-tts-1.5'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setLocalInworldModel(m)}
                  style={[
                    styles.chip,
                    localInworldModel === m && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localInworldModel === m && styles.chipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel label="Voice" style={{ marginTop: SPACING.lg }} />
            <View style={styles.chipRow}>
              {INWORLD_VOICES.map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setLocalInworldVoice(v)}
                  style={[
                    styles.chip,
                    localInworldVoice === v && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localInworldVoice === v && styles.chipTextActive,
                    ]}
                  >
                    {v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Save button at bottom */}
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.bigSaveBtn, saved && styles.bigSaveBtnSuccess]}
            activeOpacity={0.85}
          >
            <Text style={styles.bigSaveBtnText}>{saved ? '✓ Settings Saved!' : 'Save Settings'}</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ label, style }: { label: string; style?: object }) {
  return (
    <Text style={[styles.fieldLabel, style]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { paddingVertical: SPACING.xs, paddingRight: SPACING.md },
  backText: { color: COLORS.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
  title: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  saveBtn: {
    backgroundColor: COLORS.primaryMuted,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.borderActive,
  },
  saveBtnSuccess: { backgroundColor: COLORS.studiedMuted, borderColor: COLORS.studied },
  saveBtnText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
  content: { padding: SPACING.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionEmoji: { fontSize: 28 },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
  sectionSub: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  input: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontFamily: 'monospace',
  },
  eyeBtn: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { fontSize: 18 },
  hint: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bgInput,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, fontWeight: FONTS.weights.medium },
  chipTextActive: { color: COLORS.primary, fontWeight: FONTS.weights.bold },
  bigSaveBtn: {
    marginTop: SPACING.xxl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  bigSaveBtnSuccess: { backgroundColor: COLORS.studied },
  bigSaveBtnText: {
    color: '#fff',
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  themeToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xl, marginBottom: SPACING.md,
  },
  themeOption: { alignItems: 'center', gap: SPACING.xs },
  themeOptionIcon: { fontSize: 24 },
  themeOptionLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: COLORS.text },
  themeOptionInactive: { color: COLORS.textMuted },
  themeTrack: {
    width: 64, height: 32, borderRadius: 16,
    justifyContent: 'center', padding: 3,
    borderWidth: 1,
  },
  themeTrackDark: { backgroundColor: '#1E1E36', borderColor: COLORS.primary },
  themeTrackLight: { backgroundColor: '#EDE9FF', borderColor: '#6355E0' },
  themeThumb: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
  },
  themeThumbLeft: { alignSelf: 'flex-start' },
  themeThumbRight: { alignSelf: 'flex-end' },
});
