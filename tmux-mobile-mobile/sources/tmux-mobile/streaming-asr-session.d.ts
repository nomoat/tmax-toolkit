export type StreamingDictationMode =
  | "idle"
  | "connecting"
  | "recording"
  | "finishing";
export function streamingDictationControl(mode: StreamingDictationMode): {
  label: string;
  hint: string;
  icon: "wave" | "cancel" | "stop" | "spinner";
  disabled: boolean;
};
export function dictationText(base: string, text: string): string;
export function createPcmResampler(
  sampleRate: number,
  channels?: number,
): (samples: Float32Array) => ArrayBuffer;
export interface StreamingAsrSession {
  start(): Promise<void>;
  audio(bytes: ArrayBuffer): void;
  finish(): void;
  cancel(error?: string): void;
}
export function createStreamingAsrSession(options: {
  url: string;
  format?: "pcm16" | "wav" | "aac";
  providerMode?: import("./asr-provider").AsrMode;
  onProvider?: (provider: "doubao" | "wetype") => void;
  createSocket?: (url: string) => WebSocket;
  onTranscript?: (text: string, final: boolean) => void;
  onEnd?: (error?: string) => void;
}): StreamingAsrSession;
