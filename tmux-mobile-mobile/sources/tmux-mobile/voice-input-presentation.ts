export type StandardVoiceInputPhase = "idle" | "recording" | "transcribing";

export type StandardVoiceInputPresentation = {
  phase: StandardVoiceInputPhase;
  title: string;
  detail: string;
  actionLabel: string;
  accessibilityLabel: string;
};

export function resolveStandardVoiceInputPresentation({
  recording = false,
  transcribing = false,
}: {
  recording?: boolean;
  transcribing?: boolean;
}): StandardVoiceInputPresentation {
  if (transcribing) {
    return {
      phase: "transcribing",
      title: "Transcribing",
      detail: "Adding speech to this draft…",
      actionLabel: "",
      accessibilityLabel: "Transcribing voice input",
    };
  }

  if (recording) {
    return {
      phase: "recording",
      title: "Listening",
      detail: "Keep speaking — tap Stop when finished",
      actionLabel: "Stop",
      accessibilityLabel: "Stop voice input",
    };
  }

  return {
    phase: "idle",
    title: "Voice input",
    detail: "Tap to dictate into this draft",
    actionLabel: "Start",
    accessibilityLabel: "Start voice input",
  };
}
