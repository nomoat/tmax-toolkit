import { describe, expect, it } from "vitest";
import {
  clampTerminalTextScale,
  quantizeLiveTerminalTextScale,
  readTerminalTextScale,
  snapTerminalTextScale,
  TERMINAL_TEXT_SCALE_PRESETS,
} from "@/tmux-mobile/terminal-zoom";

describe("terminal pinch zoom", () => {
  it("uses the same bounded text-size presets as ORCA", () => {
    expect(TERMINAL_TEXT_SCALE_PRESETS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
    expect(clampTerminalTextScale(0.1)).toBe(0.5);
    expect(clampTerminalTextScale(4)).toBe(2);
  });

  it("updates smoothly during a pinch and snaps when the gesture finishes", () => {
    expect(quantizeLiveTerminalTextScale(1.184)).toBe(1.175);
    expect(snapTerminalTextScale(1.18)).toBe(1.25);
    expect(snapTerminalTextScale(1.62)).toBe(1.5);
  });

  it("accepts only persisted presets", () => {
    expect(readTerminalTextScale("1.5")).toBe(1.5);
    expect(readTerminalTextScale("1.3")).toBe(1);
    expect(readTerminalTextScale("broken")).toBe(1);
    expect(readTerminalTextScale(null)).toBe(1);
  });
});
