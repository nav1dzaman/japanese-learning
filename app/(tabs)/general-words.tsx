import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useGeneralWordStore } from '../../src/stores/generalWordStore';
import { useColors } from '../../src/hooks/useColors';
import { GeneralWord, GeneralWordDraft, GeneralWordStatus } from '../../src/types';
import { extractWordsFromImage, chatWithWordAssistant, ChatMessage } from '../../src/lib/gemini';
import { GeneralWordCard } from '../../src/components/GeneralWordCard';
import { FuriganaText } from '../../src/components/FuriganaText';
import { FONTS, RADIUS, SPACING, SHADOWS, type ThemeColors } from '../../src/constants/colors';

type MainTab = 'library' | 'studio';
type StudioSubTab = 'vision' | 'chat';
type StatusFilter = 'all' | 'studying' | 'studied' | 'unread';

const WORD_TYPES = [
  { label: 'All Types', value: 'All' },
  { label: '動 Verbs', value: 'verb' },
  { label: '名 Nouns', value: 'noun' },
  { label: '形 Adjectives', value: 'adjective' },
  { label: '副 Adverbs', value: 'adverb' },
  { label: '助 Particles', value: 'particle' },
  { label: '句 Expressions', value: 'expression' },
  { label: '他 Other', value: 'other' },
];

export default function GeneralWordsScreen() {
  const { user } = useAuthStore();
  const settings = useSettingsStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const {
    words,
    statusMap,
    loading: storeLoading,
    fetchWords,
    fetchStatuses,
    addWord,
    batchAddWords,
    deleteWord,
    updateStatus,
    getCategories,
    getStats,
  } = useGeneralWordStore();

  // Navigation / Tabs
  const [mainTab, setMainTab] = useState<MainTab>('library');
  const [studioTab, setStudioTab] = useState<StudioSubTab>('vision');

  // Library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');

  // Manual Add Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [manualDraft, setManualDraft] = useState<GeneralWordDraft>({
    word_english: '',
    word_japanese: '',
    word_hiragana: '',
    word_romaji: '',
    word_type: 'noun',
    sentence_english: '',
    sentence_japanese: '',
    category: 'General',
  });

  // AI Vision Staging
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedDrafts, setExtractedDrafts] = useState<GeneralWordDraft[]>([]);
  const [selectedDraftIndices, setSelectedDraftIndices] = useState<Set<number>>(new Set());
  const [savingBatch, setSavingBatch] = useState(false);

  // AI Chat Assistant
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Konnichiwa! I am your AI Japanese Sensei. You can type any Japanese word, sentence, or ask me for vocabulary recommendations. I will explain everything and prepare cards you can add directly to your General Words library!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [addedProposals, setAddedProposals] = useState<Set<string>>(new Set());
  const chatScrollRef = useRef<ScrollView>(null);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchWords(user.id);
      fetchStatuses(user.id);
    }
  }, [user]);

  const stats = getStats();
  const categories = ['All', ...getCategories()];

  // Filtered words for Library
  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      const st = statusMap[w.id] || 'unread';

      // Status match
      if (statusFilter !== 'all' && st !== statusFilter) return false;

      // Category match
      if (selectedCategory !== 'All' && w.category !== selectedCategory) return false;

      // Type match
      if (selectedType !== 'All' && (w.word_type || '').toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }

      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchJp = w.word_japanese?.toLowerCase().includes(q);
        const matchHira = w.word_hiragana?.toLowerCase().includes(q);
        const matchEn = w.word_english?.toLowerCase().includes(q);
        const matchRomaji = w.word_romaji?.toLowerCase().includes(q);
        const matchCat = w.category?.toLowerCase().includes(q);
        return matchJp || matchHira || matchEn || matchRomaji || matchCat;
      }

      return true;
    });
  }, [words, statusMap, statusFilter, selectedCategory, selectedType, searchQuery]);

  const hasActiveFilters = statusFilter !== 'all' || selectedCategory !== 'All' || selectedType !== 'All' || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setStatusFilter('all');
    setSelectedCategory('All');
    setSelectedType('All');
    setSearchQuery('');
  };

  // ── Image Picker Actions ───────────────────────────────────

  const pickImageFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Please allow gallery permissions in your settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      setImageMime(asset.mimeType || 'image/jpeg');
      setBase64Data(asset.base64 || null);
      setExtractedDrafts([]);
      setSelectedDraftIndices(new Set());
    }
  };

  const takePhotoWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Please allow camera permissions in your settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setSelectedImage(asset.uri);
      setImageMime(asset.mimeType || 'image/jpeg');
      setBase64Data(asset.base64 || null);
      setExtractedDrafts([]);
      setSelectedDraftIndices(new Set());
    }
  };

  const handleExtractFromImage = async () => {
    if (!base64Data) {
      Alert.alert('No Image', 'Please select or take an image first.');
      return;
    }

    if (!settings.geminiApiKey) {
      Alert.alert(
        'Gemini API Key Needed',
        'Please enter your Google Gemini API Key in Settings ⚙️ to use AI Vision extraction.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings') },
        ]
      );
      return;
    }

    setIsExtracting(true);
    try {
      const extracted = await extractWordsFromImage(
        base64Data,
        imageMime,
        settings.geminiApiKey,
        settings.geminiModel || 'gemini-3.6-flash'
      );

      if (extracted.length === 0) {
        Alert.alert('No Words Found', 'Could not detect Japanese vocabulary in this image. Try another photo with clearer text.');
      } else {
        setExtractedDrafts(extracted);
        setSelectedDraftIndices(new Set(extracted.map((_, i) => i)));
      }
    } catch (err: any) {
      Alert.alert('Extraction Failed', err.message || 'Error communicating with Gemini Vision API.');
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleDraftSelection = (index: number) => {
    const next = new Set(selectedDraftIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedDraftIndices(next);
  };

  const handleSaveSelectedDrafts = async () => {
    if (!user) return;
    const toSave = extractedDrafts.filter((_, idx) => selectedDraftIndices.has(idx));
    if (toSave.length === 0) {
      Alert.alert('No Words Selected', 'Please select at least one word to save.');
      return;
    }

    setSavingBatch(true);
    const count = await batchAddWords(user.id, toSave);
    setSavingBatch(false);

    if (count > 0) {
      Alert.alert(
        'Success! 🎉',
        `Successfully saved ${count} new word${count > 1 ? 's' : ''} to your General Words library!`,
        [
          {
            text: 'View Library',
            onPress: () => {
              setMainTab('library');
              setSelectedImage(null);
              setExtractedDrafts([]);
            },
          },
          { text: 'Done', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert('Save Failed', 'Could not save words to Supabase. Check your connection or database permissions.');
    }
  };

  // ── AI Chat Assistant Actions ──────────────────────────────

  const handleSendChat = async () => {
    const query = chatInput.trim();
    if (!query || isSendingChat) return;

    if (!settings.geminiApiKey) {
      Alert.alert(
        'Gemini API Key Needed',
        'Please enter your Google Gemini API Key in Settings ⚙️ to chat with Sensei.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/(tabs)/settings') },
        ]
      );
      return;
    }

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsSendingChat(true);

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await chatWithWordAssistant(
        query,
        chatMessages,
        settings.geminiApiKey,
        settings.geminiModel || 'gemini-3.6-flash'
      );

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'model',
        text: res.replyText,
        wordProposals: res.wordProposals,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, aiMsg]);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: String(Date.now() + 2),
        role: 'model',
        text: `⚠️ Error: ${err.message || 'Failed to reach Gemini API.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleAddProposalFromChat = async (proposal: GeneralWordDraft) => {
    if (!user) return;
    const newWord = await addWord(user.id, proposal);
    if (newWord) {
      setAddedProposals((prev) => new Set(prev).add(proposal.word_japanese));
    }
  };

  // ── Manual Add Submission ──────────────────────────────────

  const handleManualAddSubmit = async () => {
    if (!user) return;
    if (!manualDraft.word_japanese.trim() || !manualDraft.word_english.trim()) {
      Alert.alert('Required Fields', 'Please enter at least the Japanese word and English meaning.');
      return;
    }

    const newWord = await addWord(user.id, {
      ...manualDraft,
      word_hiragana: manualDraft.word_hiragana || manualDraft.word_japanese,
      word_romaji: manualDraft.word_romaji || '',
    });

    if (newWord) {
      setModalVisible(false);
      setManualDraft({
        word_english: '',
        word_japanese: '',
        word_hiragana: '',
        word_romaji: '',
        word_type: 'noun',
        sentence_english: '',
        sentence_japanese: '',
        category: 'General',
      });
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* ── Top Header ────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={s.titleWrap}>
          <Text style={s.title}>General Words</Text>
          <Text style={s.subHeaderTag}>AI Studio · Vocabulary</Text>
        </View>
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={s.headerAddBtn}
          activeOpacity={0.8}
        >
          <Text style={s.headerAddText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Main Navigation Segmented Control ─────────────────── */}
      <View style={s.mainTabContainer}>
        <TouchableOpacity
          style={[s.mainTabBtn, mainTab === 'library' && s.mainTabBtnActive]}
          onPress={() => setMainTab('library')}
          activeOpacity={0.8}
        >
          <Text style={[s.mainTabBtnText, mainTab === 'library' && s.mainTabBtnTextActive]}>
            📚 Library ({stats.total})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.mainTabBtn, mainTab === 'studio' && s.mainTabBtnActive]}
          onPress={() => setMainTab('studio')}
          activeOpacity={0.8}
        >
          <Text style={[s.mainTabBtnText, mainTab === 'studio' && s.mainTabBtnTextActive]}>
            🪄 AI Studio
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MODE 1: WORD LIBRARY ─────────────────────────────── */}
      {mainTab === 'library' && (
        <View style={{ flex: 1 }}>
          {/* Search Bar */}
          <View style={s.searchRow}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search Kanji, Hiragana, English..."
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={s.searchClear}>
                <Text style={s.searchClearText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Status Filter Horizontal Strip (No squishing/cracking) */}
          <View style={s.filterRibbonWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.statusScrollContent}
            >
              {(
                [
                  { id: 'all', label: 'All', emoji: '📚', count: stats.total },
                  { id: 'studying', label: 'Studying', emoji: '✏️', count: stats.studying },
                  { id: 'studied', label: 'Studied', emoji: '✅', count: stats.studied },
                  { id: 'unread', label: 'Unread', emoji: '⚪', count: stats.unread },
                ] as const
              ).map((item) => {
                const active = statusFilter === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setStatusFilter(item.id)}
                    style={[s.statusPill, active && s.statusPillActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={s.statusPillEmoji}>{item.emoji}</Text>
                    <Text style={[s.statusPillLabel, active && s.statusPillLabelActive]}>
                      {item.label}
                    </Text>
                    <View style={[s.statusPillBadge, active && s.statusPillBadgeActive]}>
                      <Text style={[s.statusPillBadgeText, active && s.statusPillBadgeTextActive]}>
                        {item.count}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Category & Word Type Filter Ribbon */}
          <View style={s.secondaryFilterWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.catScrollContent}
            >
              {/* Category Chips */}
              {categories.map((cat) => (
                <TouchableOpacity
                  key={`cat-${cat}`}
                  onPress={() => setSelectedCategory(cat)}
                  style={[s.catChip, selectedCategory === cat && s.catChipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.catChipText, selectedCategory === cat && s.catChipTextActive]}>
                    🏷️ {cat}
                  </Text>
                </TouchableOpacity>
              ))}

              <View style={s.filterDivider} />

              {/* Type Chips */}
              {WORD_TYPES.map((tp) => (
                <TouchableOpacity
                  key={`tp-${tp.value}`}
                  onPress={() => setSelectedType(tp.value)}
                  style={[s.typeFilterChip, selectedType === tp.value && s.typeFilterChipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.typeFilterChipText, selectedType === tp.value && s.typeFilterChipTextActive]}>
                    {tp.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Active Filter summary strip */}
          <View style={s.activeSummaryBar}>
            <Text style={s.activeSummaryText}>
              Showing <Text style={{ fontWeight: '700', color: C.primaryLight }}>{filteredWords.length}</Text> of {words.length} words
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={resetFilters} style={s.resetFilterBtn}>
                <Text style={s.resetFilterText}>Reset ✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Word List */}
          {storeLoading ? (
            <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
          ) : filteredWords.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>📖</Text>
              <Text style={s.emptyTitle}>No Words Match</Text>
              <Text style={s.emptySub}>
                {words.length === 0
                  ? 'Your General Words library is empty. Use the AI Studio to extract words from textbook photos or add words manually!'
                  : 'Try clearing your search query or switching your category/status filters.'}
              </Text>
              <View style={s.emptyActionsRow}>
                {hasActiveFilters ? (
                  <TouchableOpacity
                    style={[s.emptyActionBtn, { backgroundColor: C.primary }]}
                    onPress={resetFilters}
                  >
                    <Text style={[s.emptyActionBtnText, { color: '#FFF' }]}>Reset Filters</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={s.emptyActionBtn}
                      onPress={() => {
                        setMainTab('studio');
                        setStudioTab('vision');
                      }}
                    >
                      <Text style={s.emptyActionBtnText}>📷 Extract from Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.emptyActionBtn, { backgroundColor: C.primary }]}
                      onPress={() => setModalVisible(true)}
                    >
                      <Text style={[s.emptyActionBtnText, { color: '#FFF' }]}>＋ Add Word</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredWords}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <GeneralWordCard
                  word={item}
                  status={statusMap[item.id] || 'unread'}
                  onStatusChange={(newStatus) => {
                    if (user) updateStatus(user.id, item.id, newStatus);
                  }}
                  onDelete={() => deleteWord(item.id)}
                />
              )}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {/* ── MODE 2: AI STUDIO (VISION & CHAT) ─────────────────── */}
      {mainTab === 'studio' && (
        <View style={{ flex: 1 }}>
          {/* Sub-tab Toggle */}
          <View style={s.subTabContainer}>
            <TouchableOpacity
              style={[s.subTabBtn, studioTab === 'vision' && s.subTabBtnActive]}
              onPress={() => {
                Keyboard.dismiss();
                setStudioTab('vision');
              }}
            >
              <Text style={[s.subTabBtnText, studioTab === 'vision' && s.subTabBtnTextActive]}>
                📷 Vision OCR Extractor
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.subTabBtn, studioTab === 'chat' && s.subTabBtnActive]}
              onPress={() => setStudioTab('chat')}
            >
              <Text style={[s.subTabBtnText, studioTab === 'chat' && s.subTabBtnTextActive]}>
                💬 Sensei Chat
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── SUB-MODE 2A: VISION OCR EXTRACTOR ── */}
          {studioTab === 'vision' && (
            <ScrollView
              contentContainerStyle={s.visionContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Image Picker Box */}
              <View style={s.uploadCard}>
                {selectedImage ? (
                  <View style={s.imagePreviewWrapper}>
                    <Image source={{ uri: selectedImage }} style={s.imagePreview} />
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedImage(null);
                        setBase64Data(null);
                        setExtractedDrafts([]);
                      }}
                      style={s.removeImageBtn}
                    >
                      <Text style={s.removeImageText}>✕ Remove Photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.uploadPlaceholder}>
                    <Text style={s.uploadIcon}>📷</Text>
                    <Text style={s.uploadTitle}>Upload Japanese Material</Text>
                    <Text style={s.uploadSub}>
                      Take or upload a picture of a vocabulary list, book page, or flashcard. Gemini Vision will extract all words, verb forms, readings, and sentences automatically.
                    </Text>
                    <View style={s.pickerBtnRow}>
                      <TouchableOpacity
                        onPress={pickImageFromGallery}
                        style={s.pickerBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={s.pickerBtnText}>🖼️ Choose Gallery</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={takePhotoWithCamera}
                        style={[s.pickerBtn, { backgroundColor: C.primary }]}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.pickerBtnText, { color: '#FFF' }]}>📸 Take Photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Extract Button */}
                {selectedImage && (
                  <TouchableOpacity
                    onPress={handleExtractFromImage}
                    disabled={isExtracting}
                    style={[s.extractActionBtn, isExtracting && s.btnDisabled]}
                    activeOpacity={0.85}
                  >
                    {isExtracting ? (
                      <View style={s.loadingRow}>
                        <ActivityIndicator color="#FFF" size="small" />
                        <Text style={s.extractActionText}>Analyzing with Gemini Vision...</Text>
                      </View>
                    ) : (
                      <Text style={s.extractActionText}>✨ Extract Words with Gemini</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Staging / Extracted Candidates List */}
              {extractedDrafts.length > 0 && (
                <View style={s.stagingSection}>
                  <View style={s.stagingHeader}>
                    <View>
                      <Text style={s.stagingTitle}>
                        Extracted Vocabulary ({extractedDrafts.length})
                      </Text>
                      <Text style={s.stagingSub}>
                        {selectedDraftIndices.size} of {extractedDrafts.length} words selected to save
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedDraftIndices.size === extractedDrafts.length) {
                          setSelectedDraftIndices(new Set());
                        } else {
                          setSelectedDraftIndices(new Set(extractedDrafts.map((_, i) => i)));
                        }
                      }}
                      style={s.selectAllBtn}
                    >
                      <Text style={s.selectAllText}>
                        {selectedDraftIndices.size === extractedDrafts.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Candidate items */}
                  {extractedDrafts.map((item, idx) => {
                    const isSelected = selectedDraftIndices.has(idx);
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => toggleDraftSelection(idx)}
                        style={[s.candidateCard, isSelected && s.candidateCardSelected]}
                        activeOpacity={0.85}
                      >
                        <View style={s.candidateCheckRow}>
                          <View
                            style={[
                              s.checkbox,
                              isSelected && { backgroundColor: C.primary, borderColor: C.primary },
                            ]}
                          >
                            {isSelected && <Text style={s.checkboxCheck}>✓</Text>}
                          </View>
                          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                            <View style={s.candidateWordHeader}>
                              <Text style={s.candidateJp}>{item.word_japanese}</Text>
                              <View style={s.candidateTypePill}>
                                <Text style={s.candidateTypeText}>{item.word_type}</Text>
                              </View>
                            </View>
                            <Text style={s.candidateReading}>
                              {item.word_hiragana} ({item.word_romaji})
                            </Text>
                            <Text style={s.candidateEn}>{item.word_english}</Text>
                          </View>
                        </View>

                        {/* Sentence Preview */}
                        {item.sentence_japanese ? (
                          <View style={s.candidateSentenceBox}>
                            <FuriganaText text={item.sentence_japanese} fontSize={14} />
                            {item.sentence_english ? (
                              <Text style={s.candidateSentenceEn}>{item.sentence_english}</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}

                  {/* Batch Save Action Button */}
                  <TouchableOpacity
                    onPress={handleSaveSelectedDrafts}
                    disabled={savingBatch || selectedDraftIndices.size === 0}
                    style={[
                      s.saveBatchBtn,
                      (savingBatch || selectedDraftIndices.size === 0) && s.btnDisabled,
                    ]}
                    activeOpacity={0.85}
                  >
                    {savingBatch ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Text style={s.saveBatchText}>
                        📥 Save Selected ({selectedDraftIndices.size}) to Library
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}

          {/* ── SUB-MODE 2B: SENSEI CHAT (KEYBOARD RESILIENT) ── */}
          {studioTab === 'chat' && (
            <KeyboardAvoidingView
              style={s.chatWrapper}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 95 : 30}
            >
              <ScrollView
                ref={chatScrollRef}
                style={s.chatScroll}
                contentContainerStyle={s.chatContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onContentSizeChange={() => {
                  chatScrollRef.current?.scrollToEnd({ animated: true });
                }}
              >
                {chatMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <View
                      key={msg.id}
                      style={[s.chatBubbleWrapper, isUser ? s.chatBubbleRight : s.chatBubbleLeft]}
                    >
                      <View style={[s.chatBubble, isUser ? s.chatBubbleUser : s.chatBubbleModel]}>
                        <Text style={[s.chatSender, isUser ? s.chatSenderUser : s.chatSenderModel]}>
                          {isUser ? 'You' : '✨ Antigravity Sensei'}
                        </Text>
                        <Text style={[s.chatText, isUser ? s.chatTextUser : s.chatTextModel]}>
                          {msg.text}
                        </Text>

                        {/* Word Proposal Cards generated in chat */}
                        {msg.wordProposals && msg.wordProposals.length > 0 && (
                          <View style={s.proposalsContainer}>
                            <Text style={s.proposalsHeader}>Suggested Vocabulary Cards:</Text>
                            {msg.wordProposals.map((prop, pIdx) => {
                              const alreadyAdded = addedProposals.has(prop.word_japanese);
                              return (
                                <View key={pIdx} style={s.proposalCard}>
                                  <View style={s.proposalHeader}>
                                    <Text style={s.proposalWord}>{prop.word_japanese}</Text>
                                    <View style={s.proposalTypePill}>
                                      <Text style={s.proposalTypeText}>{prop.word_type}</Text>
                                    </View>
                                  </View>
                                  <Text style={s.proposalReading}>
                                    {prop.word_hiragana} • {prop.word_romaji}
                                  </Text>
                                  <Text style={s.proposalMeaning}>{prop.word_english}</Text>

                                  {prop.sentence_japanese ? (
                                    <View style={s.proposalSentenceBox}>
                                      <FuriganaText text={prop.sentence_japanese} fontSize={13} />
                                    </View>
                                  ) : null}

                                  <TouchableOpacity
                                    onPress={() => handleAddProposalFromChat(prop)}
                                    disabled={alreadyAdded}
                                    style={[
                                      s.proposalAddBtn,
                                      alreadyAdded && s.proposalAddBtnDone,
                                    ]}
                                    activeOpacity={0.8}
                                  >
                                    <Text
                                      style={[
                                        s.proposalAddText,
                                        alreadyAdded && s.proposalAddTextDone,
                                      ]}
                                    >
                                      {alreadyAdded ? '✓ Added to Library' : '＋ Add to Library'}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        <Text style={s.chatTime}>{msg.timestamp}</Text>
                      </View>
                    </View>
                  );
                })}

                {isSendingChat && (
                  <View style={[s.chatBubbleWrapper, s.chatBubbleLeft]}>
                    <View style={[s.chatBubble, s.chatBubbleModel, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                      <ActivityIndicator size="small" color={C.primary} />
                      <Text style={s.chatTextModel}>Sensei is thinking...</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Chat Input Bar Pinned above keyboard */}
              <View style={s.chatInputBar}>
                <TextInput
                  style={s.chatTextInput}
                  placeholder="Ask Sensei (e.g., 飲む, 乾杯, travel words)..."
                  placeholderTextColor={C.textMuted}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  maxLength={500}
                  onFocus={() => {
                    setTimeout(() => {
                      chatScrollRef.current?.scrollToEnd({ animated: true });
                    }, 200);
                  }}
                />
                <TouchableOpacity
                  onPress={handleSendChat}
                  disabled={!chatInput.trim() || isSendingChat}
                  style={[
                    s.chatSendBtn,
                    (!chatInput.trim() || isSendingChat) && s.btnDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={s.chatSendBtnText}>➤</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}
        </View>
      )}

      {/* ── MANUAL ADD MODAL ─────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add General Word</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={s.modalCloseBtn}>
                <Text style={s.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.inputLabel}>Japanese Word (Kanji/Kana) *</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g. 食べる"
                placeholderTextColor={C.textMuted}
                value={manualDraft.word_japanese}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, word_japanese: t }))}
              />

              <Text style={s.inputLabel}>Hiragana Reading</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g. たべる"
                placeholderTextColor={C.textMuted}
                value={manualDraft.word_hiragana}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, word_hiragana: t }))}
              />

              <Text style={s.inputLabel}>Romaji</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g. taberu"
                placeholderTextColor={C.textMuted}
                value={manualDraft.word_romaji}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, word_romaji: t }))}
              />

              <Text style={s.inputLabel}>English Meaning *</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g. to eat"
                placeholderTextColor={C.textMuted}
                value={manualDraft.word_english}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, word_english: t }))}
              />

              <Text style={s.inputLabel}>Category</Text>
              <TextInput
                style={s.modalInput}
                placeholder="e.g. Food, Travel, Daily Life"
                placeholderTextColor={C.textMuted}
                value={manualDraft.category}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, category: t }))}
              />

              <Text style={s.inputLabel}>Word Type</Text>
              <View style={s.modalTypeRow}>
                {['verb', 'noun', 'adjective', 'adverb', 'particle', 'expression', 'other'].map((tp) => (
                  <TouchableOpacity
                    key={tp}
                    onPress={() => setManualDraft((d) => ({ ...d, word_type: tp }))}
                    style={[
                      s.modalTypeChip,
                      manualDraft.word_type === tp && s.modalTypeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.modalTypeChipText,
                        manualDraft.word_type === tp && s.modalTypeChipTextActive,
                      ]}
                    >
                      {tp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.inputLabel}>Example Sentence (Japanese with [furigana])</Text>
              <TextInput
                style={[s.modalInput, { height: 60 }]}
                multiline
                placeholder="e.g. 私[わたし]はりんごを食[た]べます。"
                placeholderTextColor={C.textMuted}
                value={manualDraft.sentence_japanese}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, sentence_japanese: t }))}
              />

              <Text style={s.inputLabel}>Example Sentence (English)</Text>
              <TextInput
                style={[s.modalInput, { height: 60 }]}
                multiline
                placeholder="e.g. I eat an apple."
                placeholderTextColor={C.textMuted}
                value={manualDraft.sentence_english}
                onChangeText={(t) => setManualDraft((d) => ({ ...d, sentence_english: t }))}
              />

              <TouchableOpacity
                onPress={handleManualAddSubmit}
                style={s.modalSubmitBtn}
                activeOpacity={0.85}
              >
                <Text style={s.modalSubmitText}>Save Word</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    backBtn: {
      paddingVertical: SPACING.xs,
      paddingHorizontal: SPACING.xs,
    },
    backText: {
      fontSize: 15,
      color: C.primaryLight,
      fontWeight: '600',
    },
    titleWrap: {
      alignItems: 'center',
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: C.text,
      letterSpacing: 0.3,
    },
    subHeaderTag: {
      fontSize: 10,
      fontWeight: '600',
      color: C.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 1,
    },
    headerAddBtn: {
      backgroundColor: C.primaryMuted,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: C.primary,
    },
    headerAddText: {
      fontSize: 13,
      fontWeight: '700',
      color: C.primaryLight,
    },
    mainTabContainer: {
      flexDirection: 'row',
      marginHorizontal: SPACING.lg,
      marginVertical: SPACING.xs,
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.md,
      padding: 3,
      borderWidth: 1,
      borderColor: C.border,
    },
    mainTabBtn: {
      flex: 1,
      paddingVertical: 9,
      alignItems: 'center',
      borderRadius: RADIUS.sm,
    },
    mainTabBtnActive: {
      backgroundColor: C.primary,
    },
    mainTabBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.textSecondary,
    },
    mainTabBtnTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bgCard,
      marginHorizontal: SPACING.lg,
      marginTop: SPACING.xs,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.sm,
      borderWidth: 1,
      borderColor: C.border,
    },
    searchIcon: {
      fontSize: 14,
      marginRight: SPACING.xs,
    },
    searchInput: {
      flex: 1,
      height: 38,
      color: C.text,
      fontSize: 13,
    },
    searchClear: {
      padding: 4,
    },
    searchClearText: {
      fontSize: 13,
      color: C.textMuted,
    },
    filterRibbonWrap: {
      marginTop: SPACING.xs,
      paddingVertical: 2,
    },
    statusScrollContent: {
      paddingHorizontal: SPACING.lg,
      gap: 6,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 10,
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: C.border,
      gap: 5,
    },
    statusPillActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    statusPillEmoji: {
      fontSize: 12,
    },
    statusPillLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textSecondary,
    },
    statusPillLabelActive: {
      color: C.primaryLight,
      fontWeight: '700',
    },
    statusPillBadge: {
      backgroundColor: 'rgba(255,255,255,0.08)',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: RADIUS.full,
    },
    statusPillBadgeActive: {
      backgroundColor: C.primary,
    },
    statusPillBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: C.textMuted,
    },
    statusPillBadgeTextActive: {
      color: '#FFF',
    },
    secondaryFilterWrap: {
      marginTop: 4,
      marginBottom: 2,
    },
    catScrollContent: {
      paddingHorizontal: SPACING.lg,
      alignItems: 'center',
      gap: 6,
    },
    catChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      backgroundColor: C.bgElevated,
      borderWidth: 0.8,
      borderColor: C.border,
    },
    catChipActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    catChipText: {
      fontSize: 11,
      color: C.textSecondary,
      fontWeight: '500',
    },
    catChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    filterDivider: {
      width: 1,
      height: 18,
      backgroundColor: C.border,
      marginHorizontal: 2,
    },
    typeFilterChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      backgroundColor: C.bgElevated,
      borderWidth: 0.8,
      borderColor: C.border,
    },
    typeFilterChipActive: {
      backgroundColor: '#7C6AF7',
      borderColor: '#9B8DFF',
    },
    typeFilterChipText: {
      fontSize: 11,
      color: C.textSecondary,
      fontWeight: '500',
    },
    typeFilterChipTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    activeSummaryBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      paddingVertical: 4,
      marginBottom: 2,
    },
    activeSummaryText: {
      fontSize: 11,
      color: C.textMuted,
    },
    resetFilterBtn: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    resetFilterText: {
      fontSize: 11,
      fontWeight: '600',
      color: C.accent,
    },
    listContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxl,
      paddingTop: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xxl,
      marginTop: 40,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: SPACING.xs,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      marginBottom: SPACING.xs,
    },
    emptySub: {
      fontSize: 13,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: SPACING.lg,
    },
    emptyActionsRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    emptyActionBtn: {
      backgroundColor: C.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
    },
    emptyActionBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: C.text,
    },

    // ── AI Studio Styles ──
    subTabContainer: {
      flexDirection: 'row',
      marginHorizontal: SPACING.lg,
      marginVertical: SPACING.xs,
      gap: SPACING.xs,
    },
    subTabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: RADIUS.sm,
      backgroundColor: C.bgElevated,
      alignItems: 'center',
      borderWidth: 0.8,
      borderColor: C.border,
    },
    subTabBtnActive: {
      backgroundColor: C.primaryMuted,
      borderColor: C.primary,
    },
    subTabBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textMuted,
    },
    subTabBtnTextActive: {
      color: C.primaryLight,
      fontWeight: '700',
    },
    visionContent: {
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.xxxl,
    },
    uploadCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.lg,
      marginTop: SPACING.sm,
    },
    uploadPlaceholder: {
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    },
    uploadIcon: {
      fontSize: 38,
      marginBottom: SPACING.xs,
    },
    uploadTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 4,
    },
    uploadSub: {
      fontSize: 12,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 17,
      marginBottom: SPACING.md,
    },
    pickerBtnRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      width: '100%',
    },
    pickerBtn: {
      flex: 1,
      paddingVertical: 11,
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    pickerBtnText: {
      fontSize: 12,
      fontWeight: '600',
      color: C.text,
    },
    imagePreviewWrapper: {
      alignItems: 'center',
    },
    imagePreview: {
      width: '100%',
      height: 190,
      borderRadius: RADIUS.md,
      resizeMode: 'cover',
      marginBottom: SPACING.sm,
    },
    removeImageBtn: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(242, 95, 142, 0.15)',
    },
    removeImageText: {
      fontSize: 11,
      color: C.accent,
      fontWeight: '600',
    },
    extractActionBtn: {
      backgroundColor: C.primary,
      borderRadius: RADIUS.md,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    extractActionText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    stagingSection: {
      marginTop: SPACING.lg,
    },
    stagingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    stagingTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    stagingSub: {
      fontSize: 11,
      color: C.textMuted,
      marginTop: 2,
    },
    selectAllBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    selectAllText: {
      fontSize: 12,
      color: C.primaryLight,
      fontWeight: '600',
    },
    candidateCard: {
      backgroundColor: C.bgCard,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    candidateCardSelected: {
      borderColor: C.primary,
      backgroundColor: 'rgba(124, 106, 247, 0.06)',
    },
    candidateCheckRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxCheck: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '700',
    },
    candidateWordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    candidateJp: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
    },
    candidateTypePill: {
      backgroundColor: C.bgElevated,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: RADIUS.sm,
    },
    candidateTypeText: {
      fontSize: 10,
      color: C.textSecondary,
      fontWeight: '700',
    },
    candidateReading: {
      fontSize: 13,
      color: C.primaryLight,
      marginTop: 2,
    },
    candidateEn: {
      fontSize: 13,
      color: C.text,
      fontWeight: '500',
      marginTop: 2,
    },
    candidateSentenceBox: {
      marginTop: SPACING.xs,
      paddingTop: SPACING.xs,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    candidateSentenceEn: {
      fontSize: 12,
      color: C.textMuted,
      fontStyle: 'italic',
      marginTop: 2,
    },
    saveBatchBtn: {
      backgroundColor: C.studied,
      paddingVertical: 13,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      marginTop: SPACING.md,
    },
    saveBatchText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '700',
    },

    // ── Resilient Chat Styles ──
    chatWrapper: {
      flex: 1,
    },
    chatScroll: {
      flex: 1,
    },
    chatContent: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xl,
      gap: SPACING.sm,
    },
    chatBubbleWrapper: {
      flexDirection: 'row',
      width: '100%',
    },
    chatBubbleRight: {
      justifyContent: 'flex-end',
    },
    chatBubbleLeft: {
      justifyContent: 'flex-start',
    },
    chatBubble: {
      maxWidth: '85%',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
    },
    chatBubbleUser: {
      backgroundColor: C.primary,
      borderBottomRightRadius: 2,
    },
    chatBubbleModel: {
      backgroundColor: C.bgCard,
      borderBottomLeftRadius: 2,
      borderWidth: 1,
      borderColor: C.border,
    },
    chatSender: {
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 3,
    },
    chatSenderUser: {
      color: 'rgba(255,255,255,0.8)',
    },
    chatSenderModel: {
      color: C.primaryLight,
    },
    chatText: {
      fontSize: 14,
      lineHeight: 20,
    },
    chatTextUser: {
      color: '#FFFFFF',
    },
    chatTextModel: {
      color: C.text,
    },
    chatTime: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.5)',
      alignSelf: 'flex-end',
      marginTop: 4,
    },
    proposalsContainer: {
      marginTop: SPACING.sm,
      paddingTop: SPACING.sm,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: SPACING.xs,
    },
    proposalsHeader: {
      fontSize: 10,
      fontWeight: '700',
      color: C.textMuted,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    proposalCard: {
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      padding: SPACING.sm,
      borderWidth: 1,
      borderColor: C.border,
    },
    proposalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    proposalWord: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    proposalTypePill: {
      backgroundColor: C.bgCard,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: RADIUS.full,
    },
    proposalTypeText: {
      fontSize: 9,
      color: C.textSecondary,
      fontWeight: '700',
    },
    proposalReading: {
      fontSize: 12,
      color: C.primaryLight,
      marginTop: 2,
    },
    proposalMeaning: {
      fontSize: 13,
      fontWeight: '500',
      color: C.text,
      marginTop: 2,
    },
    proposalSentenceBox: {
      marginTop: 4,
    },
    proposalAddBtn: {
      backgroundColor: C.primary,
      paddingVertical: 6,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      marginTop: 8,
    },
    proposalAddBtnDone: {
      backgroundColor: C.studiedMuted,
      borderWidth: 1,
      borderColor: C.studied,
    },
    proposalAddText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    proposalAddTextDone: {
      color: C.studied,
    },
    chatInputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingVertical: 8,
      backgroundColor: C.bgCard,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: SPACING.xs,
    },
    chatTextInput: {
      flex: 1,
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.full,
      paddingHorizontal: SPACING.md,
      paddingVertical: Platform.OS === 'ios' ? 9 : 7,
      maxHeight: 90,
      color: C.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    chatSendBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatSendBtnText: {
      fontSize: 16,
      color: '#FFFFFF',
    },

    // ── Modal Styles ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: C.bgCard,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '88%',
      padding: SPACING.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
    },
    modalCloseBtn: {
      padding: 4,
    },
    modalCloseText: {
      fontSize: 16,
      color: C.textMuted,
    },
    modalScroll: {
      paddingBottom: SPACING.xxxl,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: C.textSecondary,
      marginTop: SPACING.sm,
      marginBottom: 4,
    },
    modalInput: {
      backgroundColor: C.bgElevated,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 8,
      color: C.text,
      fontSize: 14,
      borderWidth: 1,
      borderColor: C.border,
    },
    modalTypeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: SPACING.xs,
    },
    modalTypeChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.full,
      backgroundColor: C.bgElevated,
      borderWidth: 1,
      borderColor: C.border,
    },
    modalTypeChipActive: {
      backgroundColor: C.primary,
      borderColor: C.primary,
    },
    modalTypeChipText: {
      fontSize: 11,
      color: C.textMuted,
    },
    modalTypeChipTextActive: {
      color: '#FFF',
      fontWeight: '700',
    },
    modalSubmitBtn: {
      backgroundColor: C.primary,
      paddingVertical: 13,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      marginTop: SPACING.lg,
    },
    modalSubmitText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFF',
    },
  });
}
