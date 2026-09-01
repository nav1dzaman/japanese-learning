import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useSettingsStore,
  GROQ_MODELS,
  GEMINI_MODELS,
  INWORLD_VOICES,
} from '../../src/stores/settingsStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { useColors } from '../../src/hooks/useColors';
import { fetchGroqModels } from '../../src/lib/groq';
import { fetchGeminiModels } from '../../src/lib/gemini';
import { FONTS, RADIUS, SPACING, SHADOWS, type ThemeColors } from '../../src/constants/colors';

export default function SettingsScreen() {
  const {
    groqApiKey,
    groqModel,
    geminiApiKey,
    geminiModel,
    inworldApiKey,
    inworldModel,
    inworldVoice,
    hydrate,
    update,
  } = useSettingsStore();

  const { scheme, toggle: toggleTheme } = useThemeStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const isDark = scheme === 'dark';

  const [localGroqKey, setLocalGroqKey] = useState(groqApiKey);
  const [localGroqModel, setLocalGroqModel] = useState(groqModel);
  const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey);
  const [localGeminiModel, setLocalGeminiModel] = useState(geminiModel);
  const [localInworldKey, setLocalInworldKey] = useState(inworldApiKey);
  const [localInworldModel, setLocalInworldModel] = useState(inworldModel);
  const [localInworldVoice, setLocalInworldVoice] = useState(inworldVoice);

  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showInworldKey, setShowInworldKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dynamic model lists
  const [groqList, setGroqList] = useState<{ label: string; value: string }[]>(GROQ_MODELS);
  const [geminiList, setGeminiList] = useState<{ label: string; value: string }[]>(GEMINI_MODELS);

  // Live model check status
  const [checkingGroq, setCheckingGroq] = useState(false);
  const [groqCheckStatus, setGroqCheckStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const [checkingGemini, setCheckingGemini] = useState(false);
  const [geminiCheckStatus, setGeminiCheckStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    hydrate().then(() => {
      const st = useSettingsStore.getState();
      setLocalGroqKey(st.groqApiKey);
      setLocalGroqModel(st.groqModel);
      setLocalGeminiKey(st.geminiApiKey);
      setLocalGeminiModel(st.geminiModel);
      setLocalInworldKey(st.inworldApiKey);
      setLocalInworldModel(st.inworldModel);
      setLocalInworldVoice(st.inworldVoice);
    });
  }, []);

  const handleSave = async () => {
    await update({
      groqApiKey: localGroqKey.trim(),
      groqModel: localGroqModel,
      geminiApiKey: localGeminiKey.trim(),
      geminiModel: localGeminiModel,
      inworldApiKey: localInworldKey.trim(),
      inworldModel: localInworldModel,
      inworldVoice: localInworldVoice,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCheckGroqModels = async () => {
    const key = localGroqKey.trim();
    if (!key) {
      setGroqCheckStatus({ ok: false, msg: 'Please enter your Groq API Key first.' });
      return;
    }
    setCheckingGroq(true);
    setGroqCheckStatus(null);
    try {
      const models = await fetchGroqModels(key);
      if (models.length > 0) {
        const formatted = models.map((m) => ({ label: m.label, value: m.id }));
        setGroqList(formatted);
        // If current model is not in list, select first available
        if (!models.some((m) => m.id === localGroqModel)) {
          setLocalGroqModel(models[0].id);
        }
        setGroqCheckStatus({ ok: true, msg: `✓ Connected! Found ${models.length} active models.` });
      } else {
        setGroqCheckStatus({ ok: false, msg: 'No chat models found in this Groq account.' });
      }
    } catch (err: any) {
      setGroqCheckStatus({ ok: false, msg: err.message || 'Failed to connect to Groq.' });
    } finally {
      setCheckingGroq(false);
    }
  };

  const handleCheckGeminiModels = async () => {
    const key = localGeminiKey.trim();
    if (!key) {
      setGeminiCheckStatus({ ok: false, msg: 'Please enter your Gemini API Key first.' });
      return;
    }
    setCheckingGemini(true);
    setGeminiCheckStatus(null);
    try {
      const models = await fetchGeminiModels(key);
      if (models.length > 0) {
        setGeminiList(models);
        if (!models.some((m) => m.value === localGeminiModel)) {
          setLocalGeminiModel(models[0].value);
        }
        setGeminiCheckStatus({ ok: true, msg: `✓ Connected! Found ${models.length} active Gemini models.` });
      } else {
        setGeminiCheckStatus({ ok: false, msg: 'No Gemini models found.' });
      }
    } catch (err: any) {
      setGeminiCheckStatus({ ok: false, msg: err.message || 'Failed to connect to Gemini.' });
    } finally {
      setCheckingGemini(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[s.saveBtn, saved && s.saveBtnSuccess]}
          >
            <Text style={s.saveBtnText}>{saved ? '✓ Saved' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* ── Appearance Section ───────────────────────── */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionEmoji}>🎨</Text>
            <View>
              <Text style={s.sectionTitle}>Appearance</Text>
              <Text style={s.sectionSub}>Switch between dark and light mode</Text>
            </View>
          </View>

          <View style={s.card}>
            <View style={s.themeToggleRow}>
              <View style={s.themeOption}>
                <Text style={s.themeOptionIcon}>🌙</Text>
                <Text style={[s.themeOptionLabel, !isDark && s.themeOptionInactive]}>Dark</Text>
              </View>

              {/* Toggle track */}
              <TouchableOpacity
                onPress={toggleTheme}
                style={[
                  s.themeTrack,
                  isDark ? s.themeTrackDark : s.themeTrackLight,
                ]}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    s.themeThumb,
                    isDark ? s.themeThumbLeft : s.themeThumbRight,
                  ]}
                />
              </TouchableOpacity>

              <View style={s.themeOption}>
                <Text style={s.themeOptionIcon}>☀️</Text>
                <Text style={[s.themeOptionLabel, isDark && s.themeOptionInactive]}>Light</Text>
              </View>
            </View>
          </View>

          {/* ── Google Gemini Section ────────────────────── */}
          <View style={[s.sectionHeader, { marginTop: SPACING.xxl }]}>
            <Text style={s.sectionEmoji}>✨</Text>
            <View>
              <Text style={s.sectionTitle}>Google Gemini AI</Text>
              <Text style={s.sectionSub}>Vision OCR & Chat for General Words extraction</Text>
            </View>
          </View>

          <View style={s.card}>
            <FieldLabel label="Gemini API Key" s={s} />
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={localGeminiKey}
                onChangeText={setLocalGeminiKey}
                placeholder="AIzaSy..."
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showGeminiKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowGeminiKey((v) => !v)}
                style={s.eyeBtn}
              >
                <Text style={s.eyeText}>{showGeminiKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>Get your free key at aistudio.google.com</Text>

            {/* Check Gemini Models Action */}
            <View style={s.checkModelsRow}>
              <TouchableOpacity
                onPress={handleCheckGeminiModels}
                disabled={checkingGemini}
                style={s.checkModelsBtn}
                activeOpacity={0.8}
              >
                {checkingGemini ? (
                  <ActivityIndicator size="small" color={C.primaryLight} />
                ) : (
                  <Text style={s.checkModelsBtnText}>🔍 Check & Fetch Live Gemini Models</Text>
                )}
              </TouchableOpacity>
            </View>

            {geminiCheckStatus && (
              <View
                style={[
                  s.statusBanner,
                  geminiCheckStatus.ok ? s.statusBannerOk : s.statusBannerErr,
                ]}
              >
                <Text
                  style={[
                    s.statusBannerText,
                    geminiCheckStatus.ok ? s.statusTextOk : s.statusTextErr,
                  ]}
                >
                  {geminiCheckStatus.msg}
                </Text>
              </View>
            )}

            <FieldLabel label="Gemini Model" style={{ marginTop: SPACING.lg }} s={s} />
            <View style={s.chipRow}>
              {geminiList.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setLocalGeminiModel(m.value)}
                  style={[s.chip, localGeminiModel === m.value && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      localGeminiModel === m.value && s.chipTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Groq Section ─────────────────────────────── */}
          <View style={[s.sectionHeader, { marginTop: SPACING.xxl }]}>
            <Text style={s.sectionEmoji}>🤖</Text>
            <View>
              <Text style={s.sectionTitle}>Groq LLM</Text>
              <Text style={s.sectionSub}>Used to generate Japanese audio listening scripts</Text>
            </View>
          </View>

          <View style={s.card}>
            <FieldLabel label="Groq API Key" s={s} />
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={localGroqKey}
                onChangeText={setLocalGroqKey}
                placeholder="gsk_..."
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showGroqKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowGroqKey((v) => !v)}
                style={s.eyeBtn}
              >
                <Text style={s.eyeText}>{showGroqKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>Get your key at console.groq.com</Text>

            {/* Check Groq Models Action */}
            <View style={s.checkModelsRow}>
              <TouchableOpacity
                onPress={handleCheckGroqModels}
                disabled={checkingGroq}
                style={s.checkModelsBtn}
                activeOpacity={0.8}
              >
                {checkingGroq ? (
                  <ActivityIndicator size="small" color={C.primaryLight} />
                ) : (
                  <Text style={s.checkModelsBtnText}>🔍 Check & Fetch Live Groq Models</Text>
                )}
              </TouchableOpacity>
            </View>

            {groqCheckStatus && (
              <View
                style={[
                  s.statusBanner,
                  groqCheckStatus.ok ? s.statusBannerOk : s.statusBannerErr,
                ]}
              >
                <Text
                  style={[
                    s.statusBannerText,
                    groqCheckStatus.ok ? s.statusTextOk : s.statusTextErr,
                  ]}
                >
                  {groqCheckStatus.msg}
                </Text>
              </View>
            )}

            <FieldLabel label="Model" style={{ marginTop: SPACING.lg }} s={s} />
            <View style={s.chipRow}>
              {groqList.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setLocalGroqModel(m.value)}
                  style={[s.chip, localGroqModel === m.value && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      localGroqModel === m.value && s.chipTextActive,
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
          <View style={[s.sectionHeader, { marginTop: SPACING.xxl }]}>
            <Text style={s.sectionEmoji}>🔊</Text>
            <View>
              <Text style={s.sectionTitle}>Speech AI</Text>
              <Text style={s.sectionSub}>Inworld TTS — converts script to audio</Text>
            </View>
          </View>

          <View style={s.card}>
            <FieldLabel label="Inworld API Key" s={s} />
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={localInworldKey}
                onChangeText={setLocalInworldKey}
                placeholder="Basic key..."
                placeholderTextColor={C.textMuted}
                secureTextEntry={!showInworldKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowInworldKey((v) => !v)}
                style={s.eyeBtn}
              >
                <Text style={s.eyeText}>{showInworldKey ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>Pre-filled with default key. Get yours at inworld.ai</Text>

            <FieldLabel label="Model" style={{ marginTop: SPACING.lg }} s={s} />
            <View style={s.chipRow}>
              {['inworld-tts-2', 'inworld-tts-1.5'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setLocalInworldModel(m)}
                  style={[s.chip, localInworldModel === m && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      localInworldModel === m && s.chipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <FieldLabel label="Voice" style={{ marginTop: SPACING.lg }} s={s} />
            <View style={s.chipRow}>
              {INWORLD_VOICES.map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setLocalInworldVoice(v)}
                  style={[s.chip, localInworldVoice === v && s.chipActive]}
                >
                  <Text
                    style={[
                      s.chipText,
                      localInworldVoice === v && s.chipTextActive,
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
            style={[s.bigSaveBtn, saved && s.bigSaveBtnSuccess]}
            activeOpacity={0.85}
          >
            <Text style={s.bigSaveBtnText}>{saved ? '✓ Settings Saved!' : 'Save Settings'}</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  label,
  style,
  s,
}: {
  label: string;
  style?: object;
  s: ReturnType<typeof makeStyles>;
}) {
  return <Text style={[s.fieldLabel, style]}>{label}</Text>;
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    backBtn: { paddingVertical: SPACING.xs, paddingRight: SPACING.md },
    backText: { color: C.primary, fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semibold },
    title: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: C.text },
    saveBtn: {
      backgroundColor: C.primaryMuted,
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: C.borderActive,
    },
    saveBtnSuccess: { backgroundColor: C.studiedMuted, borderColor: C.studied },
    saveBtnText: { color: C.primary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semibold },
    content: { padding: SPACING.xl },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    sectionEmoji: { fontSize: 28 },
    sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: C.text },
    sectionSub: { fontSize: FONTS.sizes.sm, color: C.textSecondary, marginTop: 2 },
    card: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      borderWidth: 1,
      borderColor: C.border,
      ...SHADOWS.card,
    },
    fieldLabel: {
      fontSize: FONTS.sizes.sm,
      fontWeight: FONTS.weights.semibold,
      color: C.textSecondary,
      marginBottom: SPACING.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    input: {
      backgroundColor: C.bgInput,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      color: C.text,
      fontSize: FONTS.sizes.sm,
      borderWidth: 1,
      borderColor: C.border,
      fontFamily: 'monospace',
    },
    eyeBtn: {
      width: 42,
      height: 42,
      borderRadius: RADIUS.md,
      backgroundColor: C.bgInput,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeText: { fontSize: 18 },
    hint: { fontSize: FONTS.sizes.xs, color: C.textMuted, marginTop: SPACING.xs },
    checkModelsRow: {
      marginTop: SPACING.sm,
    },
    checkModelsBtn: {
      backgroundColor: C.bgElevated,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkModelsBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.primaryLight,
    },
    statusBanner: {
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderRadius: RADIUS.md,
      borderWidth: 1,
    },
    statusBannerOk: {
      backgroundColor: 'rgba(76, 175, 130, 0.12)',
      borderColor: 'rgba(76, 175, 130, 0.35)',
    },
    statusBannerErr: {
      backgroundColor: 'rgba(242, 95, 142, 0.12)',
      borderColor: 'rgba(242, 95, 142, 0.35)',
    },
    statusBannerText: {
      fontSize: 12,
    },
    statusTextOk: {
      color: '#4CAF82',
      fontWeight: '600',
    },
    statusTextErr: {
      color: C.accent,
      fontWeight: '500',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.full,
      backgroundColor: C.bgInput,
      borderWidth: 1,
      borderColor: C.border,
    },
    chipActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    chipText: { fontSize: FONTS.sizes.sm, color: C.textSecondary, fontWeight: FONTS.weights.medium },
    chipTextActive: { color: C.primary, fontWeight: FONTS.weights.bold },
    bigSaveBtn: {
      marginTop: SPACING.xxl,
      backgroundColor: C.primary,
      borderRadius: RADIUS.xl,
      paddingVertical: SPACING.lg,
      alignItems: 'center',
      ...SHADOWS.card,
    },
    bigSaveBtnSuccess: { backgroundColor: C.studied },
    bigSaveBtnText: {
      color: '#fff',
      fontSize: FONTS.sizes.md,
      fontWeight: FONTS.weights.bold,
    },
    themeToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xl,
      marginBottom: SPACING.md,
    },
    themeOption: { alignItems: 'center', gap: SPACING.xs },
    themeOptionIcon: { fontSize: 24 },
    themeOptionLabel: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold, color: C.text },
    themeOptionInactive: { color: C.textMuted },
    themeTrack: {
      width: 64,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      padding: 3,
      borderWidth: 1,
    },
    themeTrackDark: { backgroundColor: C.bgElevated, borderColor: C.primary },
    themeTrackLight: { backgroundColor: '#EDE9FF', borderColor: '#6355E0' },
    themeThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: C.primary,
    },
    themeThumbLeft: { alignSelf: 'flex-start' },
    themeThumbRight: { alignSelf: 'flex-end' },
  });
}
