export const COLORS = {
  // Background
  bg: '#0D0D1A',
  bgCard: '#16162A',
  bgElevated: '#1E1E36',
  bgInput: '#1A1A2E',

  // Primary (indigo/violet)
  primary: '#7C6AF7',
  primaryLight: '#9B8DFF',
  primaryDark: '#5B4ED0',
  primaryMuted: 'rgba(124, 106, 247, 0.15)',

  // Accent (rose for studied)
  accent: '#F25F8E',
  accentMuted: 'rgba(242, 95, 142, 0.15)',

  // Status Colors
  studying: '#F5A623',      // warm amber — in progress
  studyingMuted: 'rgba(245, 166, 35, 0.15)',
  studied: '#4CAF82',       // green — completed
  studiedMuted: 'rgba(76, 175, 130, 0.15)',
  unread: '#6B7280',        // gray — not started
  unreadMuted: 'rgba(107, 114, 128, 0.15)',

  // Text
  text: '#F0EEF8',
  textSecondary: '#9B97B8',
  textMuted: '#5E5B7A',
  textInverse: '#0D0D1A',

  // Borders
  border: 'rgba(255,255,255,0.08)',
  borderActive: 'rgba(124, 106, 247, 0.4)',

  // Feedback
  correct: '#4CAF82',
  incorrect: '#F25F8E',
  correctMuted: 'rgba(76, 175, 130, 0.2)',
  incorrectMuted: 'rgba(242, 95, 142, 0.2)',

  // Japanese red accent
  jpRed: '#FF4B4B',
  jpRedMuted: 'rgba(255, 75, 75, 0.12)',

  // Gradients (array format for LinearGradient)
  gradientPrimary: ['#7C6AF7', '#5B4ED0'] as string[],
  gradientAccent: ['#F25F8E', '#C94474'] as string[],
  gradientCard: ['#1E1E36', '#16162A'] as string[],
};

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
