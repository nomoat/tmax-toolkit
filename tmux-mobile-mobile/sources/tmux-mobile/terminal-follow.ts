export const TERMINAL_FOLLOW_PAUSE_DISTANCE = 48;
export const TERMINAL_FOLLOW_RESUME_DISTANCE = 8;

export type TerminalScrollMetrics = {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
};

export function terminalDistanceFromBottom({
  offsetY,
  viewportHeight,
  contentHeight,
}: TerminalScrollMetrics): number {
  return Math.max(0, contentHeight - viewportHeight - offsetY);
}

// Follow represents the user's intent, not the first pixel of an upward drag.
// Use hysteresis so a small touch wobble stays live while a deliberate scroll
// pauses, and only reaching the real tail turns following back on.
export function nextTerminalFollowState(
  following: boolean,
  metrics: TerminalScrollMetrics,
  userScrolling: boolean,
): boolean {
  if (!userScrolling) return following;
  const distance = terminalDistanceFromBottom(metrics);
  if (following) return distance < TERMINAL_FOLLOW_PAUSE_DISTANCE;
  return distance <= TERMINAL_FOLLOW_RESUME_DISTANCE;
}
