import { useThemeStore } from '../stores/themeStore';
import { getThemeColors, type ThemeColors } from '../constants/colors';

/** Returns the current theme's color palette — reactive to theme changes. */
export function useColors(): ThemeColors {
  const scheme = useThemeStore((s) => s.scheme);
  return getThemeColors(scheme);
}
