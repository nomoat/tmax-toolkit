export const TERMINAL_TEXT_SCALE_STORAGE_KEY = "tmux-mobile.terminal-text-scale.v1";

export const TERMINAL_TEXT_SCALE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const TERMINAL_TEXT_SCALE_MIN = TERMINAL_TEXT_SCALE_PRESETS[0];
const TERMINAL_TEXT_SCALE_MAX = TERMINAL_TEXT_SCALE_PRESETS[TERMINAL_TEXT_SCALE_PRESETS.length - 1];
const LIVE_SCALE_STEP = 0.025;

export function clampTerminalTextScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.max(TERMINAL_TEXT_SCALE_MIN, Math.min(TERMINAL_TEXT_SCALE_MAX, scale));
}

/** Keep live pinch feedback smooth without forcing a render for every sub-pixel event. */
export function quantizeLiveTerminalTextScale(scale: number): number {
  const clamped = clampTerminalTextScale(scale);
  return Math.round(clamped / LIVE_SCALE_STEP) * LIVE_SCALE_STEP;
}

/** Match ORCA: a completed pinch settles on the nearest reusable text-size preset. */
export function snapTerminalTextScale(scale: number): number {
  const clamped = clampTerminalTextScale(scale);
  return TERMINAL_TEXT_SCALE_PRESETS.reduce((nearest, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(nearest - clamped) ? candidate : nearest,
  );
}

export function readTerminalTextScale(value: string | null): number {
  if (value === null) return 1;
  const parsed = Number(value);
  return (TERMINAL_TEXT_SCALE_PRESETS as readonly number[]).includes(parsed) ? parsed : 1;
}
