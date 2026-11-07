import { describe, expect, it } from "vitest";
import {
  sessionCardFoldState,
  shouldFoldSessionCards,
} from "@/tmux-mobile/card-folding";

describe("shouldFoldSessionCards", () => {
  it("uses the same accordion on ordinary iOS and Android clients", () => {
    expect(shouldFoldSessionCards({ os: "ios" })).toBe(true);
    expect(shouldFoldSessionCards({ os: "android" })).toBe(true);
    expect(shouldFoldSessionCards({ os: "ios", isPad: true })).toBe(false);
    expect(shouldFoldSessionCards({ os: "ios", isVision: true })).toBe(false);
  });

  it("keeps Vision compatibility mode and web expanded", () => {
    expect(
      shouldFoldSessionCards({ os: "ios", visionDeviceDetected: true }),
    ).toBe(false);
    expect(shouldFoldSessionCards({ os: "web" })).toBe(false);
  });
});

describe("sessionCardFoldState", () => {
  it("keeps every recent emphasized native card expanded", () => {
    expect(
      sessionCardFoldState({
        foldSessionCards: true,
        recentActivity: true,
        manuallyExpanded: false,
      }),
    ).toEqual({ collapsible: false, expanded: true });
  });

  it("defaults muted native cards to collapsed but permits a manual expansion", () => {
    expect(
      sessionCardFoldState({
        foldSessionCards: true,
        recentActivity: false,
        manuallyExpanded: false,
      }),
    ).toEqual({ collapsible: true, expanded: false });
    expect(
      sessionCardFoldState({
        foldSessionCards: true,
        recentActivity: false,
        manuallyExpanded: true,
      }),
    ).toEqual({ collapsible: true, expanded: true });
  });

  it("keeps cards expanded when the device does not use folding", () => {
    expect(
      sessionCardFoldState({
        foldSessionCards: false,
        recentActivity: false,
        manuallyExpanded: false,
      }),
    ).toEqual({ collapsible: false, expanded: true });
  });

  it.each([
    { recentActivity: false, manuallyExpanded: false, expected: { collapsible: true, expanded: false } },
    { recentActivity: false, manuallyExpanded: true, expected: { collapsible: true, expanded: true } },
    { recentActivity: true, manuallyExpanded: false, expected: { collapsible: false, expanded: true } },
    { recentActivity: true, manuallyExpanded: true, expected: { collapsible: false, expanded: true } },
  ])("keeps iOS and Android in parity for $recentActivity / $manuallyExpanded", ({ recentActivity, manuallyExpanded, expected }) => {
    for (const os of ["ios", "android"]) {
      expect(sessionCardFoldState({
        foldSessionCards: shouldFoldSessionCards({ os }),
        recentActivity,
        manuallyExpanded,
      })).toEqual(expected);
    }
  });
});
