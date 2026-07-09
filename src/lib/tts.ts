import * as FileSystem from 'expo-file-system/legacy';

const TTS_ENDPOINT = 'https://api.inworld.ai/tts/v1/voice';

export interface SynthesisResult {
  fileUri: string;
  timestamps: { word: string; start_time: number; end_time: number }[];
  duration: number;
}

/**
 * Synthesize Japanese text using Inworld TTS non-streaming endpoint.
 * API docs: https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech.md
 */
export async function synthesizeSpeech(
  text: string,
  apiKey: string,
  model: string = 'inworld-tts-2',
  voice: string = 'Asuka'
): Promise<SynthesisResult> {
  const response = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      text,
      voiceId: voice,
      modelId: model,
      audioConfig: { speakingRate: 0.9 },
      deliveryMode: 'BALANCED',
      language: 'ja-JP',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Inworld TTS error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Write base64 MP3 to local cache file
  const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, data.audioContent, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { fileUri, timestamps: [], duration: 0 };
}
