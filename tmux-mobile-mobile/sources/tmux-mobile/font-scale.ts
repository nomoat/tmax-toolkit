export const FONT_SCALE_LEVELS = ["standard", "large", "extra-large"] as const;

export type FontScaleLevel = (typeof FONT_SCALE_LEVELS)[number];

export const FONT_SCALE_STORAGE_KEY = "tmux-mobile.font-scale.v1";

export const FONT_SCALE_VALUES: Record<FontScaleLevel, number> = {
  standard: 1,
  large: 1.15,
  "extra-large": 1.3,
};

export const FONT_SCALE_LABELS: Record<FontScaleLevel, string> = {
  standard: "Standard",
  large: "Large",
  "extra-large": "Extra large",
};

export function readFontScaleLevel(value: string | null): FontScaleLevel {
  return FONT_SCALE_LEVELS.includes(value as FontScaleLevel)
    ? (value as FontScaleLevel)
    : "standard";
}

export function stepFontScale(
  current: FontScaleLevel,
  direction: -1 | 1,
): FontScaleLevel {
  const currentIndex = FONT_SCALE_LEVELS.indexOf(current);
  const nextIndex = Math.max(
    0,
    Math.min(FONT_SCALE_LEVELS.length - 1, currentIndex + direction),
  );
  return FONT_SCALE_LEVELS[nextIndex];
}

function scaledMetric(value: number, scale: number): number {
  return Math.round(value * scale * 2) / 2;
}

export function scaleTextMetrics<
  T extends Record<string, Record<string, unknown>>,
>(definitions: T, scale: number): T {
  if (scale === 1) return definitions;
  return Object.fromEntries(
    Object.entries(definitions).map(([name, definition]) => {
      const next = { ...definition };
      if (typeof next.fontSize === "number") {
        next.fontSize = scaledMetric(next.fontSize, scale);
      }
      if (typeof next.lineHeight === "number") {
        next.lineHeight = scaledMetric(next.lineHeight, scale);
      }
      return [name, next];
    }),
  ) as T;
}
