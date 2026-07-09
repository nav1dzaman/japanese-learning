// ── Dark Theme (default) ──────────────────────────────────────────────────────
const DARK = {
  bg: '#0D0D1A',
  bgCard: '#16162A',
  bgElevated: '#1E1E36',
  bgInput: '#1A1A2E',

  primary: '#7C6AF7',
  primaryLight: '#9B8DFF',
  primaryDark: '#5B4ED0',
  primaryMuted: 'rgba(124, 106, 247, 0.15)',

  accent: '#F25F8E',
  accentMuted: 'rgba(242, 95, 142, 0.15)',

  studying: '#F5A623',
  studyingMuted: 'rgba(245, 166, 35, 0.15)',
  studied: '#4CAF82',
  studiedMuted: 'rgba(76, 175, 130, 0.15)',
  unread: '#6B7280',
  unreadMuted: 'rgba(107, 114, 128, 0.15)',

  text: '#F0EEF8',
  textSecondary: '#9B97B8',
  textMuted: '#5E5B7A',
  textInverse: '#0D0D1A',

  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(124, 106, 247, 0.4)',

  correct: '#4CAF82',
  incorrect: '#F25F8E',
  correctMuted: 'rgba(76, 175, 130, 0.2)',
  incorrectMuted: 'rgba(242, 95, 142, 0.2)',

  jpRed: '#FF4B4B',
  jpRedMuted: 'rgba(255, 75, 75, 0.12)',

  gradientPrimary: ['#7C6AF7', '#5B4ED0'] as string[],
  gradientAccent: ['#F25F8E', '#C94474'] as string[],
  gradientCard: ['#1E1E36', '#16162A'] as string[],

  // Chart
  chartBar: '#7C6AF7',
  chartBarSecondary: '#4CAF82',
  chartGrid: 'rgba(255,255,255,0.06)',
};

// ── Light Theme ───────────────────────────────────────────────────────────────
const LIGHT = {
  bg: '#F5F4FF',
  bgCard: '#FFFFFF',
  bgElevated: '#EDE9FF',
  bgInput: '#EDEDF7',

  primary: '#6355E0',
  primaryLight: '#7C6AF7',
  primaryDark: '#4B3DBB',
  primaryMuted: 'rgba(99, 85, 224, 0.12)',

  accent: '#E0446A',
  accentMuted: 'rgba(224, 68, 106, 0.12)',

  studying: '#D4850A',
  studyingMuted: 'rgba(212, 133, 10, 0.12)',
  studied: '#2E9665',
  studiedMuted: 'rgba(46, 150, 101, 0.12)',
  unread: '#6B7280',
  unreadMuted: 'rgba(107, 114, 128, 0.10)',

  text: '#16142A',
  textSecondary: '#5A5680',
  textMuted: '#A09CC0',
  textInverse: '#FFFFFF',

  border: 'rgba(0,0,0,0.08)',
  borderActive: 'rgba(99, 85, 224, 0.3)',

  correct: '#2E9665',
  incorrect: '#E0446A',
  correctMuted: 'rgba(46, 150, 101, 0.15)',
  incorrectMuted: 'rgba(224, 68, 106, 0.15)',

  jpRed: '#D93030',
  jpRedMuted: 'rgba(217, 48, 48, 0.10)',

  gradientPrimary: ['#6355E0', '#4B3DBB'] as string[],
  gradientAccent: ['#E0446A', '#B8355A'] as string[],
  gradientCard: ['#FFFFFF', '#F0EEFF'] as string[],

  // Chart
  chartBar: '#6355E0',
  chartBarSecondary: '#2E9665',
  chartGrid: 'rgba(0,0,0,0.05)',
};

export type ThemeColors = typeof DARK;

/** Returns colors for the given scheme */
export function getThemeColors(scheme: 'dark' | 'light'): ThemeColors {
  return scheme === 'light' ? LIGHT : DARK;
}

/** Legacy default export — kept for backward compat with existing screens */
export const COLORS: ThemeColors = DARK;

export const FONTS = {
  regular: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    xxxl: 34,
    japanese: 28,
    japaneseXl: 40,
  },
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#7C6AF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  glass: {
    shadowColor: '#7C6AF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
};
