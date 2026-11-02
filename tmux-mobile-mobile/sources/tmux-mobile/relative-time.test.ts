import { describe, expect, it } from "vitest";
import {
  isRecentActivity,
  RECENT_ACTIVITY_WINDOW_MS,
  relativeTimeLabel,
} from "@/tmux-mobile/relative-time";

const NOW = Date.parse("2026-07-26T12:00:00.000Z");

describe("isRecentActivity", () => {
  it("highlights activity through the fourteen-hour boundary", () => {
    expect(isRecentActivity(new Date(NOW - RECENT_ACTIVITY_WINDOW_MS + 1).toISOString(), NOW)).toBe(true);
    expect(isRecentActivity(new Date(NOW - RECENT_ACTIVITY_WINDOW_MS).toISOString(), NOW)).toBe(true);
    expect(isRecentActivity(new Date(NOW - RECENT_ACTIVITY_WINDOW_MS - 1).toISOString(), NOW)).toBe(false);
  });

  it("does not highlight missing, invalid, or future activity", () => {
    expect(isRecentActivity(null, NOW)).toBe(false);
    expect(isRecentActivity("not-a-date", NOW)).toBe(false);
    expect(isRecentActivity(new Date(NOW + 1).toISOString(), NOW)).toBe(false);
  });

  it("treats activity older than fourteen hours as stale", () => {
    expect(isRecentActivity(new Date(NOW - 14 * 60 * 60 * 1_000).toISOString(), NOW)).toBe(true);
    expect(isRecentActivity(new Date(NOW - 14 * 60 * 60 * 1_000 - 1).toISOString(), NOW)).toBe(false);
  });
});

describe("relativeTimeLabel", () => {
  it("formats card timestamps against an injected clock", () => {
    expect(relativeTimeLabel(new Date(NOW).toISOString(), NOW)).toBe("now");
    expect(relativeTimeLabel(new Date(NOW - 5 * 60 * 60 * 1_000).toISOString(), NOW)).toBe("5h ago");
    expect(relativeTimeLabel(new Date(NOW + 2 * 60 * 1_000).toISOString(), NOW)).toBe("in 2m");
    expect(relativeTimeLabel("not-a-date", NOW)).toBe("");
  });
});
