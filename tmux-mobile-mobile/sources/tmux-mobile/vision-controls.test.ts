import { describe, expect, it } from "vitest";
import {
  EDITABLE_FIELD_IDS,
  normalizeSpokenControllerUrl,
  resolveFieldPresentation,
  resolvePaneComposerPresentation,
  resolveVisionControls,
  requiresVisionModeChoice,
} from "./vision-controls";

describe("automatic Vision controls", () => {
  it("detects Vision Pro automatically and ignores forced-on preferences elsewhere", () => {
    for (const preference of ["auto", "on"] as const) {
      for (const detected of [true, false]) {
        expect(resolveVisionControls(preference, detected)).toBe(detected);
      }
    }
    for (const detected of [true, false, null]) {
      for (const saved of ["auto", "on", null] as const) {
        expect(requiresVisionModeChoice(detected, saved)).toBe(false);
      }
    }
  });
  it.each(EDITABLE_FIELD_IDS)(
    "%s uses voice buttons on Vision Pro",
    (field) => {
      expect(resolveFieldPresentation(field, true)).toBe("voice");
      expect(resolveFieldPresentation(field, false)).toBe("editable-text");
    },
  );
  it("preserves uploads, shortcuts and the composer for legacy and current settings", () => {
    for (const visionControls of [true, false]) {
      expect(
        resolvePaneComposerPresentation({
          visionControls,
          showShortcuts: true,
          showUpload: true,
        }),
      ).toMatchObject({
        mountTextInput: !visionControls,
        showShortcuts: true,
        showUpload: true,
        showMore: false,
      });
      expect(resolveFieldPresentation("terminal-output", visionControls)).toBe(
        "readonly",
      );
    }
  });
});

describe("normalizeSpokenControllerUrl", () => {
  it("maps the default controller phrases", () => {
    expect(normalizeSpokenControllerUrl("eng dot impo dot ai")).toBe(
      "https://eng.xyznot.com",
    );
    expect(normalizeSpokenControllerUrl("production")).toBe(
      "https://eng.xyznot.com",
    );
  });

  it("normalizes a spoken custom host", () => {
    expect(normalizeSpokenControllerUrl("demo dot example dot com")).toBe(
      "https://demo.example.com",
    );
  });
});
