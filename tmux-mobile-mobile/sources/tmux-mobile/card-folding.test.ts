import { describe, expect, it } from "vitest";
import {
  sessionCardFoldState,
  shouldFoldSessionCards,
} from "@/tmux-mobile/card-folding";

describe("shouldFoldSessionCards", () => {
  it("enables the accordion only on iPhone", () => {
    expect(shouldFoldSessionCards({ os: "ios" })).toBe(true);
    expect(shouldFoldSessionCards({ os: "ios", isPad: true })).toBe(false);
    expect(shouldFoldSessionCards({ os: "ios", isVision: true })).toBe(false);
  });

  it("keeps Vision compatibility mode and non-iOS platforms expanded", () => {
    expect(
      shouldFoldSessionCards({ os: "ios", visionDeviceDetected: true }),
    ).toBe(false);
    expect(shouldFoldSessionCards({ os: "android" })).toBe(false);
    expect(shouldFoldSessionCards({ os: "web" })).toBe(false);
  });
});

describe("sessionCardFoldState", () => {
  it("keeps every recent emphasized iPhone card expanded", () => {
    expect(
      sessionCardFoldState({
        foldSessionCards: true,
        recentActivity: true,
        manuallyExpanded: false,
      }),
    ).toEqual({ collapsible: false, expanded: true });
  });

  it("defaults muted iPhone cards to collapsed but permits a manual expansion", () => {
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
});
