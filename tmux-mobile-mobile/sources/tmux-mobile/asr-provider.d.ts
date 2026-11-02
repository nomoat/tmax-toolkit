export type AsrMode = "auto" | "doubao" | "wetype";
export const ASR_PREFERENCE_KEY: string;
export const ASR_OPTIONS: { value: AsrMode; label: string; description: string }[];
export function normalizeAsrMode(value: unknown): AsrMode;
export function asrProviderName(value: string): string;
export function asrStatus(stage: "recording" | "finishing" | "done", provider?: string): string;
export function createAsrPreference(storage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}): {
  subscribe(listener: () => void): () => void;
  getSnapshot(): AsrMode;
  load(): Promise<void>;
  setMode(mode: AsrMode): Promise<void>;
};
