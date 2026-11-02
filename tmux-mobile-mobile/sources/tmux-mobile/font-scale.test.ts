import { describe, expect, it } from "vitest";
import {
  FONT_SCALE_VALUES,
  readFontScaleLevel,
  scaleTextMetrics,
  stepFontScale,
} from "./font-scale";

describe("font scale", () => {
  it("normalizes persisted values", () => {
    expect(readFontScaleLevel("large")).toBe("large");
    expect(readFontScaleLevel("extra-large")).toBe("extra-large");
    expect(readFontScaleLevel("unknown")).toBe("standard");
    expect(readFontScaleLevel(null)).toBe("standard");
  });

  it("steps between bounded levels", () => {
    expect(stepFontScale("standard", -1)).toBe("standard");
    expect(stepFontScale("standard", 1)).toBe("large");
    expect(stepFontScale("large", 1)).toBe("extra-large");
    expect(stepFontScale("extra-large", 1)).toBe("extra-large");
  });

  it("scales font size and line height without changing layout metrics", () => {
    const definitions = {
      body: { fontSize: 15, lineHeight: 21, padding: 12 },
      frame: { minHeight: 44 },
    };
    expect(scaleTextMetrics(definitions, FONT_SCALE_VALUES.large)).toEqual({
      body: { fontSize: 17.5, lineHeight: 24, padding: 12 },
      frame: { minHeight: 44 },
    });
  });
});
