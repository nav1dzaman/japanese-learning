import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { useColors } from '../hooks/useColors';

interface FuriganaTextProps {
  text: string;
  fontSize?: number;
  textColor?: string;
  furiganaColor?: string;
  style?: TextStyle | TextStyle[];
}

interface Segment {
  text: string;
  furigana?: string;
}

/**
 * Robust Japanese Furigana parser:
 * Attaches bracketed ruby readings [furigana] specifically to the Kanji
 * preceding the bracket, keeping preceding and succeeding Kana/punctuation
 * cleanly separated as plain text.
 */
export function parseFurigana(input: string): Segment[] {
  if (!input) return [];

  const segments: Segment[] = [];
  const rubyRegex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rubyRegex.exec(input)) !== null) {
    const furigana = match[1];
    const matchStart = match.index;
    const matchEnd = rubyRegex.lastIndex;

    const precedingChunk = input.slice(lastIndex, matchStart);

    if (precedingChunk) {
      // Find trailing Kanji in precedingChunk (including kanji repeat mark 々)
      const kanjiMatch = precedingChunk.match(/([\u4E00-\u9FAF\u3400-\u4DBF\uF900-\uFAFF々〆〇]+)$/);

      if (kanjiMatch && kanjiMatch.index !== undefined) {
        const kanjiStart = kanjiMatch.index;
        const plainPrefix = precedingChunk.slice(0, kanjiStart);
        const kanjiText = kanjiMatch[1];

        if (plainPrefix) {
          segments.push({ text: plainPrefix });
        }
        segments.push({ text: kanjiText, furigana });
      } else {
        // If no trailing Kanji, check for word boundaries or treat the whole chunk as target
        const lastSpace = Math.max(precedingChunk.lastIndexOf(' '), precedingChunk.lastIndexOf('　'));
        if (lastSpace !== -1) {
          const plainPrefix = precedingChunk.slice(0, lastSpace + 1);
          const targetWord = precedingChunk.slice(lastSpace + 1);
          if (plainPrefix) segments.push({ text: plainPrefix });
          segments.push({ text: targetWord, furigana });
        } else {
          segments.push({ text: precedingChunk, furigana });
        }
      }
    }

    lastIndex = matchEnd;
  }

  // Trailing text after the last ruby match
  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }

  return segments;
}

export function FuriganaText({
  text,
  fontSize = 16,
  textColor,
  furiganaColor,
  style,
}: FuriganaTextProps) {
  const C = useColors();
  const color = textColor || C.text;
  const fColor = furiganaColor || C.primaryLight;

  if (!text) return null;

  const segments = parseFurigana(text);
  const fSize = Math.max(9, Math.round(fontSize * 0.52));
  const fLineHeight = Math.max(11, Math.round(fontSize * 0.62));
  const mainLineHeight = Math.round(fontSize * 1.35);

  return (
    <View style={styles.container}>
      {segments.map((seg, idx) => {
        if (seg.furigana) {
          return (
            <View key={idx} style={styles.rubyContainer}>
              <Text
                style={[
                  styles.furigana,
                  {
                    fontSize: fSize,
                    lineHeight: fLineHeight,
                    color: fColor,
                  },
                ]}
                numberOfLines={1}
              >
                {seg.furigana}
              </Text>
              <Text
                style={[
                  styles.kanji,
                  {
                    fontSize,
                    lineHeight: mainLineHeight,
                    color,
                  },
                  style,
                ]}
              >
                {seg.text}
              </Text>
            </View>
          );
        }

        return (
          <View key={idx} style={styles.plainContainer}>
            {/* Height-matched spacer ensures 100% pixel-perfect baseline alignment */}
            <View style={{ height: fLineHeight + 2 }} />
            <Text
              style={[
                styles.plainText,
                {
                  fontSize,
                  lineHeight: mainLineHeight,
                  color,
                },
                style,
              ]}
            >
              {seg.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    rowGap: 6,
  },
  rubyContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 0.5,
  },
  plainContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  furigana: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  kanji: {
    fontWeight: '600',
    textAlign: 'center',
  },
  plainText: {
    fontWeight: '400',
  },
});
