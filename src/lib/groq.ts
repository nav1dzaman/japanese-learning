const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

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
}

export interface GeneratedScript {
  text: string;           // full Japanese text (joined sentences)
  sentences: SentencePair[];
  usedWords: { word: string; reading: string; meaning: string }[];
}

function levelDescription(levels: JlptLevel[]): string {
  if (levels.length === 1) return `JLPT ${levels[0]}`;
  return `JLPT ${levels[0]} to ${levels[levels.length - 1]}`;
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

  const prompt = `You are a Japanese language teacher creating listening practice material.

Generate a natural Japanese ${isDialogue ? 'short dialogue between two people (use A: / B: speaker labels)' : 'monologue or short conversation'} at ${levelDescription(levels)} level.

Vocabulary to incorporate:
${wordList}

Word usage instruction: ${FREQUENCY_INSTRUCTION[frequency]}

Other requirements:
- Length: approximately ${LENGTH_WORDS[length]} Japanese words total
- Grammar and kanji difficulty appropriate for ${levelDescription(levels)}
- End sentences with 。or ！ or ？

Respond ONLY with valid JSON in this exact format — no markdown, no explanation:
{
  "sentences": [
    {"ja": "Japanese sentence here。", "en": "English translation here."},
    {"ja": "Next sentence。", "en": "Translation."}
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
      max_tokens: 1200,
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
  try {
    const parsed = JSON.parse(raw);
    sentences = (parsed.sentences ?? []).map((s: any) => ({
      ja: String(s.ja ?? ''),
      en: String(s.en ?? ''),
    }));
  } catch {
    // Fallback: treat entire text as one sentence with no translation
    sentences = [{ ja: raw, en: '' }];
  }

  const text = sentences.map((s) => s.ja).join('');

  // Find which input words appear in the generated text
  const usedWords = words.filter(
    (w) => text.includes(w.word) || text.includes(w.reading)
  );

  return { text, sentences, usedWords };
}
