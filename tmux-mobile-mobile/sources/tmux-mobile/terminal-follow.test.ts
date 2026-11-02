import { describe, expect, it } from "vitest";
import {
  nextTerminalFollowState,
  TERMINAL_FOLLOW_PAUSE_DISTANCE,
  TERMINAL_FOLLOW_RESUME_DISTANCE,
  terminalDistanceFromBottom,
} from "./terminal-follow";

const metricsAtDistance = (distance: number) => ({
  offsetY: 1_000 - 400 - distance,
  viewportHeight: 400,
  contentHeight: 1_000,
});

describe("terminal follow", () => {
  it("measures distance from the live tail", () => {
    expect(terminalDistanceFromBottom(metricsAtDistance(37))).toBe(37);
    expect(terminalDistanceFromBottom(metricsAtDistance(-12))).toBe(0);
  });

  it("does not pause for a slight upward drag", () => {
    expect(
      nextTerminalFollowState(
        true,
        metricsAtDistance(TERMINAL_FOLLOW_PAUSE_DISTANCE - 1),
        true,
      ),
    ).toBe(true);
  });

  it("pauses after a deliberate upward scroll", () => {
    expect(
      nextTerminalFollowState(
        true,
        metricsAtDistance(TERMINAL_FOLLOW_PAUSE_DISTANCE),
        true,
      ),
    ).toBe(false);
  });

  it("resumes only when the user returns to the bottom", () => {
    expect(
      nextTerminalFollowState(
        false,
        metricsAtDistance(TERMINAL_FOLLOW_RESUME_DISTANCE + 1),
        true,
      ),
    ).toBe(false);
    expect(
      nextTerminalFollowState(
        false,
        metricsAtDistance(TERMINAL_FOLLOW_RESUME_DISTANCE),
        true,
      ),
    ).toBe(true);
  });

  it("ignores programmatic and layout-driven scroll events", () => {
    expect(nextTerminalFollowState(true, metricsAtDistance(300), false)).toBe(true);
    expect(nextTerminalFollowState(false, metricsAtDistance(0), false)).toBe(false);
  });
});
