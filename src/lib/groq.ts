const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_ENDPOINT = 'https://api.groq.com/openai/v1/models';

/**
 * Fetch live active models from Groq API using user's API Key
 */
export async function fetchGroqModels(apiKey: string): Promise<{ id: string; label: string }[]> {
  if (!apiKey) throw new Error('Groq API Key is required to fetch models.');

  const res = await fetch(GROQ_MODELS_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Groq models (${res.status}): ${err}`);
  }

  const data = await res.json();
  const models: string[] = (data.data ?? [])
    .map((m: any) => m.id)
    .filter(
      (id: string) =>
        !id.includes('whisper') &&
        !id.includes('guard') &&
        !id.includes('embed') &&
        !id.includes('distil-whisper')
    )
    .sort();

  return models.map((id) => ({
    id,
    label: formatGroqModelLabel(id),
  }));
}

function formatGroqModelLabel(id: string): string {
  if (id === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B (Recommended)';
  if (id === 'llama-3.1-8b-instant') return 'Llama 3.1 8B (Instant)';
  if (id === 'deepseek-r1-distill-llama-70b') return 'DeepSeek R1 70B (Reasoning)';
  if (id === 'llama-3.2-11b-vision-preview') return 'Llama 3.2 11B (Vision)';
  if (id === 'llama-3.2-3b-preview') return 'Llama 3.2 3B (Compact)';
  if (id === 'llama-3.2-1b-preview') return 'Llama 3.2 1B (Light)';
  return id;
}

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type ScriptLength = 'short' | 'medium' | 'long';
export type WordFrequency = 'high' | 'medium' | 'low';

const LENGTH_WORDS: Record<ScriptLength, string> = {
  short: '50–70',
  medium: '100–130',
  long: '170–200',
};

const FREQUENCY_INSTRUCTION: Record<WordFrequency, string> = {
  high: 'You MUST use almost every word from the vocabulary list above. The script should heavily feature these exact words.',
  medium: 'Use about half of the vocabulary words naturally. It is fine to add other natural words to make the text flow well.',
  low: 'Use only a few of the vocabulary words. Focus on natural, fluent Japanese; other JLPT-appropriate vocabulary is preferred to make it sound organic.',
};

export interface SentencePair {
  ja: string;   // Japanese sentence
  en: string;   // English translation
  speaker?: string; // Optional speaker identifier
}

export interface GeneratedScript {
  text: string;           // full Japanese text (joined sentences)
  speechText: string;     // cleaned Japanese text for Inworld TTS (without "A:", "B:", speaker labels)
  sentences: SentencePair[];
  usedWords: { word: string; reading: string; meaning: string }[];
}

function levelDescription(levels: JlptLevel[]): string {
  if (levels.length === 1) return `JLPT ${levels[0]}`;
  return `JLPT ${levels[0]} to ${levels[levels.length - 1]}`;
}

/**
 * Remove speaker prefix labels like "A:", "B:", "田中さん：", "[A] ", "Speaker 1:"
 * so that TTS reads clean natural Japanese without speaking out "A" or "B".
 */
export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Replace leading speaker identifiers like "A: ", "B: ", "Aさん: ", "田中: ", "男: ", "女: "
    .replace(/(?:^|\n)\s*(?:[A-ZＡ-Ｚ]|(?:Person\s*[A-Z0-9])|(?:Speaker\s*[A-Z0-9])|(?:[A-Z]\s*さん)|(?:[\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FF]{1,6}(?:さん|くん|君|様)?))\s*[:：]\s*/gim, '\n')
    .replace(/\[(?:[A-Z0-9]|Speaker\s*[0-9])\]\s*/gi, '')
    .replace(/\((?:[A-Z0-9]|Speaker\s*[0-9])\)\s*/gi, '')
    .trim();
}

export async function generateAudioScript(
  words: { word: string; reading: string; meaning: string }[],
  levels: JlptLevel[],
  length: ScriptLength,
  frequency: WordFrequency,
  apiKey: string,
  model: string
): Promise<GeneratedScript> {
  const wordList = words
    .slice(0, 40)
    .map((w) => `${w.word} (${w.reading}): ${w.meaning}`)
    .join('\n');

  const isDialogue = levels.includes('N5') || levels.includes('N4');

  const prompt = `You are an expert Japanese language teacher creating listening practice audio lessons.

Generate a natural Japanese ${
    isDialogue
      ? 'short dialogue between two people (e.g. A and B speaking naturally)'
      : 'monologue or short conversation'
  } at ${levelDescription(levels)} level.

Key vocabulary to incorporate:
${wordList}

Word usage instruction: ${FREQUENCY_INSTRUCTION[frequency]}

Other requirements:
- Length: approximately ${LENGTH_WORDS[length]} Japanese words total
- Grammar and kanji difficulty appropriate for ${levelDescription(levels)}
- Make the dialogue/monologue sound fluent, realistic, and conversational.
- End sentences with 。or ！ or ？
- Provide a full list of ALL Japanese vocabulary words that appear in the script (including both the incorporated words AND other useful words in the text) with their kanji/kana, full hiragana reading, and clear English meaning.

Respond ONLY with valid JSON in this exact structure — no markdown fences, no conversational explanations:
{
  "sentences": [
    {"ja": "A: こんにちは！最近[さいきん]、どうですか。", "en": "A: Hello! How have you been recently?"},
    {"ja": "B: 元気[げんき]です。日本語[にほんご]を勉強[べんきょう]しています。", "en": "B: I'm good. I'm studying Japanese."}
  ],
  "vocabulary": [
    {"word": "最近", "reading": "さいきん", "meaning": "recently / lately"},
    {"word": "元気", "reading": "げんき", "meaning": "healthy / energetic"},
    {"word": "勉強する", "reading": "べんきょうする", "meaning": "to study"}
  ]
}`;

  const response = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';

  // Strip markdown code fences if model wraps response
  raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let sentences: SentencePair[] = [];
  let scriptVocab: { word: string; reading: string; meaning: string }[] = [];

  try {
    const parsed = JSON.parse(raw);
    sentences = (parsed.sentences ?? []).map((s: any) => ({
      ja: String(s.ja ?? ''),
      en: String(s.en ?? ''),
    }));

    if (Array.isArray(parsed.vocabulary)) {
      scriptVocab = parsed.vocabulary
        .filter((v: any) => v && (v.word || v.japanese))
        .map((v: any) => ({
          word: String(v.word || v.japanese || ''),
          reading: String(v.reading || v.hiragana || v.word || ''),
          meaning: String(v.meaning || v.english || ''),
        }));
    }
  } catch {
    // Fallback: treat entire text as one sentence
    sentences = [{ ja: raw, en: '' }];
  }

  const text = sentences.map((s) => s.ja).join('\n');
  const speechText = cleanTextForSpeech(text);

  // Combine words returned by LLM with any input words that appeared in the script
  const vocabMap = new Map<string, { word: string; reading: string; meaning: string }>();

  // 1. Add words from LLM's comprehensive vocabulary list
  for (const item of scriptVocab) {
    if (item.word) vocabMap.set(item.word, item);
  }

  // 2. Also ensure any original input words that appear in the script are included
  for (const w of words) {
    if (text.includes(w.word) || text.includes(w.reading)) {
      if (!vocabMap.has(w.word)) {
        vocabMap.set(w.word, w);
      }
    }
  }

  const usedWords = Array.from(vocabMap.values());

  return { text, speechText, sentences, usedWords };
}
