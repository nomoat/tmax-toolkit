import { Platform } from "react-native";

// Solarized surfaces and high-contrast dark text, shared with T-MAX Web.
const palette = {
  canvas: "#fdf6e3",
  panel: "#fdf6e3",
  raised: "#eee8d5",
  line: "#93a1a1",
  accent: "#073642",
  text: "#586e75",
  muted: "#586e75",
  soft: "#eee8d5",
  success: "#859900",
  warning: "#b58900",
  danger: "#dc322f",
  darkCanvas: "#002b36",
  darkPaper: "#002b36",
  darkRaised: "#073642",
  darkLine: "#586e75",
  darkText: "#eee8d5",
  darkMuted: "#c0cdcd",
};

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  title: {
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontSize: 24,
    lineHeight: 30,
  },
  section: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  mono: {
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
} as const;

export const lightTheme = {
  dark: false,
  spacing,
  radii,
  typography,
  colors: {
    background: palette.canvas,
    surface: palette.panel,
    surfaceRaised: palette.raised,
    surfaceMuted: palette.soft,
    border: palette.line,
    text: palette.text,
    textMuted: palette.muted,
    accent: palette.accent,
    accentSoft: "#eee8d5",
    orange: "#cb4b16",
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    dangerSoft: "#dc322f14",
    successSoft: "#85990014",
    warningSoft: "#b5890014",
    groupped: {
      background: palette.canvas,
    },
    header: {
      background: palette.panel,
      tint: palette.text,
    },
  },
};

export const darkTheme = {
  dark: true,
  spacing,
  radii,
  typography,
  colors: {
    background: palette.darkCanvas,
    surface: palette.darkPaper,
    surfaceRaised: palette.darkRaised,
    surfaceMuted: "#073642",
    border: palette.darkLine,
    text: palette.darkText,
    textMuted: palette.darkMuted,
    accent: palette.darkText,
    accentSoft: "#073642",
    orange: "#cb4b16",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
    dangerSoft: "#dc322f24",
    successSoft: "#85990024",
    warningSoft: "#b5890024",
    groupped: {
      background: palette.darkCanvas,
    },
    header: {
      background: palette.darkPaper,
      tint: palette.darkText,
    },
  },
};

export type AppTheme = typeof lightTheme;
