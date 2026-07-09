import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Verb, VerbStatus } from '../types';
import { COLORS, FONTS, RADIUS, SPACING } from '../constants/colors';

interface VerbCardProps {
  verb: Verb;
  status: VerbStatus;
  onStatusChange: (status: VerbStatus) => void;
}

const STATUS_CONFIG: Record<
  VerbStatus,
  { emoji: string; color: string; next: VerbStatus }
> = {
  unread:   { emoji: '📖', color: COLORS.textMuted,  next: 'studying' },
  studying: { emoji: '✏️', color: COLORS.studying,   next: 'studied'  },
  studied:  { emoji: '✅', color: COLORS.studied,    next: 'unread'   },
};

const BORDER_COLORS: Record<VerbStatus, string> = {
  unread:   COLORS.border,
  studying: COLORS.studying,
  studied:  COLORS.studied,
};

const VERB_TYPE_SHORT: Record<string, string> = {
  'う': 'U',
  'る': 'RU',
  'irregular': 'IRR',
  'する': 'SU',
  'くる': 'KU',
};

function getTypeShort(verbType: string | null | undefined): { label: string; color: string } {
  if (!verbType) return { label: '?', color: COLORS.textMuted };
  const key = Object.keys(VERB_TYPE_SHORT).find(
    (k) => verbType.toLowerCase().includes(k) || verbType === k
  );
  const label = VERB_TYPE_SHORT[key ?? ''] ?? verbType.slice(0, 3).toUpperCase();
  const colors: Record<string, string> = {
    U: '#7C6AF7', RU: '#4CAF82', IRR: '#F25F8E', SU: '#F5A623', KU: '#F25F8E',
  };
  return { label, color: colors[label] ?? COLORS.textMuted };
}

export function VerbCard({ verb, status, onStatusChange }: VerbCardProps) {
  const [expanded, setExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const cfg = STATUS_CONFIG[status];
  const typeInfo = getTypeShort(verb.verb_type);

  const toggle = () => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    setExpanded((e) => !e);
  };

  const chevron = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggle}
      style={[styles.row, { borderLeftColor: BORDER_COLORS[status] }]}
    >
      {/* ── Left: word column ── */}
      <View style={styles.wordCol}>

        {/* Line 1: dictionary + type chip */}
        <View style={styles.line1}>
          <Text style={styles.dict} numberOfLines={1}>{verb.dictionary ?? '—'}</Text>
          <View style={[styles.typeChip, { borderColor: `${typeInfo.color}60`, backgroundColor: `${typeInfo.color}15` }]}>
            <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
          </View>
        </View>

        {/* Line 2: te-form + meaning */}
        <View style={styles.line2}>
          {verb.te_form ? (
            <Text style={styles.teForm}>{verb.te_form}</Text>
          ) : null}
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meaning} numberOfLines={1}>{verb.meaning ?? '—'}</Text>
        </View>
      </View>

      {/* ── Right: status dot + chevron ── */}
      <View style={styles.rightCol}>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onStatusChange(cfg.next); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.statusDot, { backgroundColor: `${cfg.color}20`, borderColor: cfg.color }]}
        >
          <Text style={styles.statusEmoji}>{cfg.emoji}</Text>
        </TouchableOpacity>
        <Animated.Text style={[styles.chevron, { transform: [{ rotate: chevron }] }]}>
          ▾
        </Animated.Text>
      </View>

      {/* ── Expanded forms ── */}
      {expanded && (
        <View style={styles.forms}>
          <View style={styles.formsGrid}>
            <FormPair label="ます" value={verb.masu_form} />
            <FormPair label="て" value={verb.te_form} accent />
            <FormPair label="ない" value={verb.nai_form} />
            <FormPair label="可能" value={verb.potential_form} />
            <FormPair label="意志" value={verb.plain_volitional} />
            <FormPair label="丁寧意志" value={verb.polite_volitional} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function FormPair({ label, value, accent }: { label: string; value: string | null | undefined; accent?: boolean }) {
  return (
    <View style={styles.formPair}>
      <Text style={styles.formLabel}>{label}</Text>
      <Text style={[styles.formValue, accent && styles.formValueAccent]}>{value ?? '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: COLORS.bgCard,
    borderLeftWidth: 2,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    marginBottom: 4,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },

  /* Word column */
  wordCol: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },

  line1: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dict: {
    fontSize: 17,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  typeChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 9,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0.5,
  },

  line2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  teForm: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.3,
  },
  dot: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  meaning: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },

  /* Right column */
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  statusDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusEmoji: { fontSize: 14 },
  chevron: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  /* Expanded forms */
  forms: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 6,
    paddingTop: 8,
  },
  formsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  formPair: {
    width: '30%',
    gap: 1,
  },
  formLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.medium,
    letterSpacing: 0.5,
  },
  formValue: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: FONTS.weights.semibold,
    letterSpacing: 0.3,
  },
  formValueAccent: {
    color: COLORS.primaryLight,
  },
});
