export const VISION_CONTROLS_PREFERENCE_KEY = "tmux-mobile.vision-controls";

export const EDITABLE_FIELD_IDS = [
  "controller-url",
  "composer",
  "shortcut-item",
  "shortcut-new",
  "window-name",
  "artifact-name",
  "agent-cwd",
  "agent-mux",
  "agent-session-name",
] as const;

export type EditableFieldId = (typeof EDITABLE_FIELD_IDS)[number];
export type VisionFieldId = EditableFieldId | "terminal-output";
export type FieldPresentation = "editable-text" | "voice" | "hidden" | "readonly";
export type VisionControlsPreference = "auto" | "on";

// Detection is automatic. Ignore legacy forced-on settings on phones/tablets.

export function resolveVisionControls(
  preference: VisionControlsPreference,
  detectedOnVision: boolean,
): boolean {
  return detectedOnVision;
}

export function requiresVisionModeChoice(
  nativeVisionStatus: boolean | null,
  savedPreference: VisionControlsPreference | null,
): boolean {
  return false;
}

export function resolveFieldPresentation(
  field: VisionFieldId,
  visionControls: boolean,
): FieldPresentation {
  if (field === "terminal-output") return "readonly";
  return visionControls ? "voice" : "editable-text";
}

export function resolvePaneComposerPresentation({
  visionControls,
  showShortcuts,
  showUpload,
}: {
  visionControls: boolean;
  showShortcuts: boolean;
  showUpload: boolean;
}) {
  return {
    mountTextInput: !visionControls,
    showShortcuts,
    showUpload,
    showVoice: true,
    showKeys: true,
    showSend: true,
    showQuickKeys: false,
    showMore: false,
  };
}

export function normalizeSpokenControllerUrl(transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return "";
  const lowered = spoken.toLowerCase();
  if (
    lowered.includes("production") ||
    lowered.includes("default") ||
    lowered.includes("正式") ||
    (lowered.includes("eng") && lowered.includes("impo") && lowered.includes("ai"))
  ) {
    return "https://eng.xyznot.com";
  }

  const compact = lowered
    .replace(/\bhttps?\s*colon\s*(?:slash\s*){2}/g, (value) =>
      value.startsWith("https") ? "https://" : "http://",
    )
    .replace(/\bdot\b/g, ".")
    .replace(/\bslash\b/g, "/")
    .replace(/\bcolon\b/g, ":")
    .replace(/\s+/g, "");
  if (/^https?:\/\//.test(compact)) return compact;
  return `https://${compact}`;
}
