export const RECENT_ACTIVITY_WINDOW_MS = 14 * 60 * 60 * 1_000;

function timestampMs(value: string | null | undefined): number {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}

export function isRecentActivity(
  value: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  const activityMs = timestampMs(value);
  if (!activityMs || !Number.isFinite(nowMs)) return false;
  const ageMs = nowMs - activityMs;
  return ageMs >= 0 && ageMs <= RECENT_ACTIVITY_WINDOW_MS;
}

export function relativeTimeLabel(
  value: string | null | undefined,
  nowMs = Date.now(),
): string {
  const ms = timestampMs(value);
  if (!ms || !Number.isFinite(nowMs)) return "";
  const diffMs = nowMs - ms;
  const future = diffMs < 0;
  const seconds = Math.max(0, Math.round(Math.abs(diffMs) / 1_000));
  if (seconds < 45) return future ? "soon" : "now";
  const units = [
    ["d", 86_400],
    ["h", 3_600],
    ["m", 60],
  ] as const;
  for (const [label, size] of units) {
    if (seconds >= size) {
      const count = Math.floor(seconds / size);
      return future ? `in ${count}${label}` : `${count}${label} ago`;
    }
  }
  return future ? "in 1m" : "1m ago";
}
