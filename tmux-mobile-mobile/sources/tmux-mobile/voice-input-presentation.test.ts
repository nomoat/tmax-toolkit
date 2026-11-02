import { describe, expect, it } from "vitest";

import { resolveStandardVoiceInputPresentation } from "./voice-input-presentation";

describe("resolveStandardVoiceInputPresentation", () => {
  it("makes idle voice input discoverable", () => {
    expect(resolveStandardVoiceInputPresentation({})).toEqual({
      phase: "idle",
      title: "Voice input",
      detail: "Tap to dictate into this draft",
      actionLabel: "Start",
      accessibilityLabel: "Start voice input",
    });
  });

  it("makes the manual stop action explicit while recording", () => {
    expect(resolveStandardVoiceInputPresentation({ recording: true })).toEqual({
      phase: "recording",
      title: "Listening",
      detail: "Keep speaking — tap Stop when finished",
      actionLabel: "Stop",
      accessibilityLabel: "Stop voice input",
    });
  });

  it("shows transcription as busy instead of as a tappable stop action", () => {
    expect(resolveStandardVoiceInputPresentation({ transcribing: true })).toEqual({
      phase: "transcribing",
      title: "Transcribing",
      detail: "Adding speech to this draft…",
      actionLabel: "",
      accessibilityLabel: "Transcribing voice input",
    });
  });

  it("lets transcribing win if native events briefly overlap phases", () => {
    expect(
      resolveStandardVoiceInputPresentation({
        recording: true,
        transcribing: true,
      }).phase,
    ).toBe("transcribing");
  });
});
