import type { ThemePalette } from "./types";

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB hex color.
 */
export function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "").trim();
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lR = toLinear(r);
  const lG = toLinear(g);
  const lB = toLinear(b);

  return 0.2126 * lR + 0.7152 * lG + 0.0722 * lB;
}

/**
 * Computes the WCAG contrast ratio between two hex colors.
 * Returns a value between 1:1 and 21:1.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 10) / 10;
}

export const THEME_PALETTES: Record<string, ThemePalette> = {
  slate_emerald: {
    id: "slate_emerald",
    name: "Slate & Emerald",
    isDark: true,
    background: "0F172A",     // Slate 900
    surface: "1E293B",        // Slate 800
    textPrimary: "F8FAFC",    // Slate 50
    textSecondary: "94A3B8",  // Slate 400
    accent: "10B981",         // Emerald 500
    highlight: "34D399",      // Emerald 400
    headerFont: "Outfit",
    bodyFont: "Inter",
    contrastRatio: getContrastRatio("0F172A", "F8FAFC"), // ~17.5:1 (Exceeds WCAG AAA)
  },
  obsidian_gold: {
    id: "obsidian_gold",
    name: "Obsidian & Gold",
    isDark: true,
    background: "090A0F",     // Deep Obsidian
    surface: "171923",        // Dark Charcoal
    textPrimary: "FFFFFF",    // White
    textSecondary: "A0AEC0",  // Cool Gray
    accent: "D97706",         // Amber/Gold
    highlight: "FBBF24",      // Bright Gold
    headerFont: "Poppins",
    bodyFont: "Inter",
    contrastRatio: getContrastRatio("090A0F", "FFFFFF"), // ~20.1:1
  },
  midnight_indigo: {
    id: "midnight_indigo",
    name: "Midnight Indigo",
    isDark: true,
    background: "0A0F1D",     // Midnight Blue
    surface: "151D33",        // Deep Indigo
    textPrimary: "F1F5F9",    // Slate 100
    textSecondary: "818CF8",  // Indigo 400
    accent: "6366F1",         // Indigo 500
    highlight: "38BDF8",      // Sky 400
    headerFont: "Outfit",
    bodyFont: "Inter",
    contrastRatio: getContrastRatio("0A0F1D", "F1F5F9"), // ~18.2:1
  },
  arctic_frost: {
    id: "arctic_frost",
    name: "Arctic Frost",
    isDark: false,
    background: "F8FAFC",     // Slate 50
    surface: "FFFFFF",        // Pure White
    textPrimary: "0F172A",    // Slate 900
    textSecondary: "475569",  // Slate 600
    accent: "0284C7",         // Sky 600
    highlight: "0369A1",      // Sky 700
    headerFont: "Outfit",
    bodyFont: "Inter",
    contrastRatio: getContrastRatio("F8FAFC", "0F172A"), // ~17.2:1
  },
  warm_sand: {
    id: "warm_sand",
    name: "Warm Editorial Sand",
    isDark: false,
    background: "FDFBF7",     // Warm Paper
    surface: "F7F4EE",        // Light Sand
    textPrimary: "1C1917",    // Warm Stone 900
    textSecondary: "57534E",  // Warm Stone 600
    accent: "B45309",         // Amber 700
    highlight: "92400E",      // Amber 800
    headerFont: "Playfair Display",
    bodyFont: "Source Sans 3",
    contrastRatio: getContrastRatio("FDFBF7", "1C1917"), // ~16.8:1
  },
};

export function getTheme(themeId?: string): ThemePalette {
  if (themeId && THEME_PALETTES[themeId]) {
    return THEME_PALETTES[themeId];
  }
  return THEME_PALETTES.slate_emerald;
}
