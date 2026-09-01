import { GeneralWordDraft, VerbForms } from '../types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GEMINI_MODELS = [
  { label: 'Gemini 3.6 Flash (Recommended)', value: 'gemini-3.6-flash' },
  { label: 'Gemini 3.6 Pro (Deep Reasoning)', value: 'gemini-3.6-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
];

/**
 * Fetch live active models from Gemini API using user's API Key
 */
export async function fetchGeminiModels(apiKey: string): Promise<{ value: string; label: string }[]> {
  if (!apiKey) throw new Error('Gemini API Key is required to fetch models.');

  const res = await fetch(`${GEMINI_BASE}?key=${apiKey}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch Gemini models (${res.status}): ${err}`);
  }

  const data = await res.json();
  const rawList: string[] = (data.models ?? [])
    .map((m: any) => (m.name || '').replace('models/', ''))
    .filter(
      (name: string) =>
        name.startsWith('gemini-') &&
        !name.includes('embedding') &&
        !name.includes('aqa') &&
        !name.includes('imagen')
    )
    .sort();

  return rawList.map((val) => ({
    value: val,
    label: val,
  }));
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  wordProposals?: GeneralWordDraft[];
  timestamp: string;
}

const EXTRACTION_PROMPT = `You are an expert Japanese linguist and teacher.
Analyze the Japanese content in the provided image (which could be a textbook, vocabulary list, handwritten note, sign, or flashcard).
Identify and extract every distinct Japanese vocabulary word found in the image.

For EACH word, extract and generate the following fields:
1. word_english: Clear, accurate English meaning or translation.
2. word_japanese: The Japanese word written with kanji/kana as standard (e.g. 食べる, りんご, 綺麗).
3. word_hiragana: Full reading in Hiragana only (e.g. たべる, りんご, きれい).
4. word_romaji: Hepburn Romaji (e.g. taberu, ringo, kirei).
5. word_type: One of 'verb', 'noun', 'adjective', 'adverb', 'particle', 'expression', 'other'.
6. verb_forms: If word_type is 'verb', return a JSON object with:
   {
     "nai": "negative form (e.g. 食べない)",
     "te": "te-form (e.g. 食べて)",
     "potential": "potential form (e.g. 食べられる)",
     "volitional": "volitional form (e.g. 食べよう)",
     "masu": "polite masu form (e.g. 食べます)",
     "ta": "past ta form (e.g. 食べた)"
   }
   If not a verb, set verb_forms to null.
7. sentence_english: A natural, clear example sentence in English.
8. sentence_japanese: The Japanese translation of the sentence. IMPORTANT: Always format all Kanji with bracketed Hiragana furigana directly after the kanji, like:
   "私[わたし]は毎朝[まいあさ]りんごを食[た]べます。" or "天気[てんき]がいいですね。"
9. category: Relevant thematic or JLPT category (e.g. 'Daily Life', 'Food', 'Travel', 'Work', 'Emotion', 'Nature', 'JLPT N5', 'JLPT N4', etc.).

Return ONLY a valid JSON array of objects with these exact keys. No markdown code blocks, no backticks, no explanations.
Example output format:
[
  {
    "word_english": "to eat",
    "word_japanese": "食べる",
    "word_hiragana": "たべる",
    "word_romaji": "taberu",
    "word_type": "verb",
    "verb_forms": {
      "nai": "食べない",
      "te": "食べて",
      "potential": "食べられる",
      "volitional": "食べよう",
      "masu": "食べます",
      "ta": "食べた"
    },
    "sentence_english": "I eat breakfast at seven every day.",
    "sentence_japanese": "私[わたし]は毎日[まいにち]七時[しちじ]に朝[あさ]ご飯[はん]を食[た]べます。",
    "category": "Daily Life"
  }
]`;

/**
 * Extract words from an image using Gemini Vision
 */
export async function extractWordsFromImage(
  base64Data: string,
  mimeType: string = 'image/jpeg',
  apiKey: string,
  model: string = 'gemini-3.6-flash'
): Promise<GeneralWordDraft[]> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings ⚙️.');
  }

  const endpoint = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: EXTRACTION_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '[]';

  const cleanText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed)) {
      return parsed.map(sanitizeWordDraft);
    } else if (parsed && typeof parsed === 'object') {
      return [sanitizeWordDraft(parsed)];
    }
    return [];
  } catch (err: any) {
    throw new Error(`Failed to parse extracted words from Gemini: ${err.message}`);
  }
}

/**
 * Chat with Gemini Word Assistant to validate words and generate proposal cards
 */
export async function chatWithWordAssistant(
  userQuery: string,
  history: ChatMessage[],
  apiKey: string,
  model: string = 'gemini-3.6-flash'
): Promise<{ replyText: string; wordProposals: GeneralWordDraft[] }> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in Settings ⚙️.');
  }

  const endpoint = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are Antigravity Sensei, an intelligent and friendly Japanese learning assistant.
When the user sends a message, question, or Japanese word/phrase:
1. Check if the user is asking about or mentioning Japanese vocabulary words (e.g. "is 諦める valid?", "what does 乾杯 mean?", "teach me words for airport", "飲む", "nomu").
2. In your reply, provide helpful feedback, corrections if any, nuances, and conversational explanations in friendly Markdown.
3. IF you identify any Japanese words that would be great additions to the user's General Words vocabulary library, output them at the VERY END of your response inside a structured JSON block delimited by :::WORDS_JSON::: and :::END_WORDS_JSON:::.
The format inside must be an array of word objects:
:::WORDS_JSON:::
[
  {
    "word_english": "...",
    "word_japanese": "...",
    "word_hiragana": "...",
    "word_romaji": "...",
    "word_type": "verb|noun|adjective|adverb|particle|expression|other",
    "verb_forms": { "nai": "...", "te": "...", "potential": "...", "volitional": "...", "masu": "...", "ta": "..." } or null,
    "sentence_english": "...",
    "sentence_japanese": "Kanji[hiragana] formatted sentence",
    "category": "..."
  }
]
:::END_WORDS_JSON:::

If no specific words need to be added or the user is just saying hi/asking general questions, omit the :::WORDS_JSON::: block.`;

  // Build contents array for Gemini
  const contents: any[] = [];

  // Add system instruction context as initial exchange if needed
  contents.push({
    role: 'user',
    parts: [{ text: `[System Instruction]\n${systemInstruction}\n\nUser: Hello Sensei!` }],
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'Konnichiwa! I am your Japanese learning assistant. Ask me any word, sentence, or grammar concept and I will explain and prepare vocabulary cards for you!' }],
  });

  // Append recent history (up to last 6 turns)
  const recentHistory = history.slice(-6);
  for (const h of recentHistory) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }],
    });
  }

  // Add current query
  contents.push({
    role: 'user',
    parts: [{ text: userQuery }],
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  let replyText = rawText;
  let wordProposals: GeneralWordDraft[] = [];

  const jsonMatch = rawText.match(/:::WORDS_JSON:::([\s\S]*?):::END_WORDS_JSON:::/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(parsed)) {
        wordProposals = parsed.map(sanitizeWordDraft);
      } else if (parsed && typeof parsed === 'object') {
        wordProposals = [sanitizeWordDraft(parsed)];
      }
    } catch {
      // Ignore JSON parse error in conversational chat
    }
    // Clean reply text to remove the raw JSON delimiters for clean display
    replyText = rawText.replace(/:::WORDS_JSON:::[\s\S]*?:::END_WORDS_JSON:::/, '').trim();
  }

  return { replyText, wordProposals };
}

function sanitizeWordDraft(item: any): GeneralWordDraft {
  const word_type = String(item.word_type || 'noun').toLowerCase();
  let verb_forms: VerbForms | null = null;

  if (word_type.includes('verb') && item.verb_forms && typeof item.verb_forms === 'object') {
    verb_forms = {
      nai: item.verb_forms.nai ? String(item.verb_forms.nai) : undefined,
      te: item.verb_forms.te ? String(item.verb_forms.te) : undefined,
      potential: item.verb_forms.potential ? String(item.verb_forms.potential) : undefined,
      volitional: item.verb_forms.volitional ? String(item.verb_forms.volitional) : undefined,
      masu: item.verb_forms.masu ? String(item.verb_forms.masu) : undefined,
      ta: item.verb_forms.ta ? String(item.verb_forms.ta) : undefined,
    };
  }

  return {
    word_english: String(item.word_english || item.english || '').trim(),
    word_japanese: String(item.word_japanese || item.japanese || item.word || '').trim(),
    word_hiragana: String(item.word_hiragana || item.hiragana || item.reading || '').trim(),
    word_romaji: String(item.word_romaji || item.romaji || '').trim(),
    word_type: word_type || 'noun',
    verb_forms,
    sentence_english: item.sentence_english ? String(item.sentence_english).trim() : undefined,
    sentence_japanese: item.sentence_japanese ? String(item.sentence_japanese).trim() : undefined,
    category: item.category ? String(item.category).trim() : 'General',
  };
}
