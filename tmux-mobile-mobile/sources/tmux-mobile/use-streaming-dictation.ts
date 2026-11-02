import * as React from "react";
import { asrStatus } from "./asr-provider";
import { speechPreference } from "./speech-preference";
import { AppState, Platform } from "react-native";
import {
  AudioModule,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type RecordingOptions,
} from "expo-audio";
import {
  getInfoAsync,
  readAsStringAsync,
  deleteAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { toByteArray } from "base64-js";
import { holdDictationScreenAwake } from "./dictation-screen-awake";
import type { TmuxMobileApi } from "./api";
import {
  createPcmResampler,
  createStreamingAsrSession,
  dictationText,
  type StreamingAsrSession,
  type StreamingDictationMode,
} from "./streaming-asr-session";

const NativeWebSocket = WebSocket as unknown as {
  new (
    url: string,
    protocols: undefined,
    options: { headers: Record<string, string> },
  ): WebSocket;
};

type NativeStream = {
  start(): Promise<void>;
  stop(): void;
  release(): void;
  addListener(
    name: string,
    callback: (buffer: {
      data: ArrayBuffer;
      sampleRate: number;
      channels: number;
    }) => void,
  ): { remove(): void };
};
type Capture = {
  screenAwake?: ReturnType<typeof holdDictationScreenAwake>;
  session?: StreamingAsrSession;
  stream?: NativeStream;
  recorder?: AudioRecorder;
  uri?: string;
  text: string;
  provider: string;
  result: Promise<string | null>;
  complete: (text: string | null) => void;
  ready?: boolean;
  offset: number;
  cancelled: boolean;
  stopping?: boolean;
  timer?: ReturnType<typeof setInterval>;
  reading?: Promise<void>;
  cleanup?: Promise<void>;
  setup?: Promise<void>;
  format: "pcm16" | "wav" | "aac";
  pump?: () => Promise<void>;
};
export const STREAM_RECORDING_OPTIONS: RecordingOptions = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  ios: {
    extension: ".wav",
    outputFormat: "lpcm",
    audioQuality: 96,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: ".aac",
    outputFormat: "aac_adts",
    audioEncoder: "aac",
    sampleRate: 16000,
  },
  web: {},
};

export function useStreamingDictation({
  api,
  scopeKey,
  value,
  onChangeText,
  onStatus,
}: {
  api: TmuxMobileApi | null;
  scopeKey: string;
  value: string;
  onChangeText: (text: string) => void;
  onStatus: (status: string) => void;
}) {
  const [mode, setMode] = React.useState<StreamingDictationMode>("idle");
  const [sending, setSending] = React.useState(false);
  const sendingRef = React.useRef(false);
  const generation = React.useRef(0);
  const mounted = React.useRef(true);
  const current = React.useRef<Capture | null>(null),
    pendingCleanup = React.useRef<Promise<void>>(Promise.resolve());
  const latest = React.useRef({ api, scopeKey, value, onChangeText, onStatus });
  latest.current = { api, scopeKey, value, onChangeText, onStatus };
  const cleanup = React.useCallback((state: Capture, drain = false) => {
    if (state.cleanup) return state.cleanup;
    clearInterval(state.timer);
    // Release immediately on Stop/Cancel, not after a permission dialog, socket
    // handshake or final transcript finishes. The lease handles pending activation.
    const screenReleased = state.screenAwake?.release();
    state.cleanup = (async () => {
      // A cancelled permission/start request may still be completing.
      await state.setup;
      clearInterval(state.timer);
      try {
        state.stream?.stop();
      } catch {}
      try {
        state.stream?.release();
      } catch {}
      if (state.recorder) {
        try {
          await state.recorder.stop();
        } catch {}
        try {
          await state.reading;
          if (drain && !state.cancelled) await state.pump?.();
        } catch {
          state.session?.cancel(
            "Could not finish microphone audio. Your current text was kept.",
          );
        }
        try {
          state.recorder.release();
        } catch {}
      }
      if (state.uri)
        await deleteAsync(state.uri, { idempotent: true }).catch(() => {});
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      await screenReleased;
    })();
    pendingCleanup.current = state.cleanup;
    return state.cleanup;
  }, []);
  const cancel = React.useCallback(() => {
    generation.current += 1;
    const state = current.current;
    if (!state) return;
    current.current = null;
    state.cancelled = true;
    state.complete(null);
    state.session?.cancel();
    void cleanup(state);
  }, [cleanup]);
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  React.useEffect(() => {
    setMode("idle");
    return cancel;
  }, [scopeKey, cancel]);
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" && current.current) {
        cancel();
        setMode("idle");
        latest.current.onStatus(
          "Live dictation stopped. Your current text was kept.",
        );
      }
    });
    return () => subscription.remove();
  }, [cancel]);
  const finish = React.useCallback(async (): Promise<string | null> => {
    const active = current.current;
    if (!active) return latest.current.value;
    if (!active.ready) {
      cancel();
      setMode("idle");
      latest.current.onStatus("Live dictation stopped. Your current text was kept.");
      return null;
    }
    if (!active.stopping) {
      active.stopping = true;
      setMode("finishing");
      latest.current.onStatus(asrStatus("finishing", active.provider));
      try {
        await cleanup(active, true);
        if (!active.cancelled) active.session?.finish();
      } catch {
        active.session?.cancel("Could not finish live dictation. Your current text was kept.");
      }
    }
    return active.result;
  }, [cancel, cleanup]);
  const submit = React.useCallback(async (send: (text: string) => Promise<void>, allowEmpty = false) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const requestGeneration = generation.current;
    const requestScope = latest.current.scopeKey;
    const wasActive = Boolean(current.current);
    try {
      const text = await finish();
      if (text === null || !mounted.current || generation.current !== requestGeneration || latest.current.scopeKey !== requestScope) return;
      if (!text.trim() && (wasActive || !allowEmpty)) {
        latest.current.onStatus("No text to send");
        return;
      }
      await send(text);
    } finally {
      sendingRef.current = false;
      if (mounted.current) setSending(false);
    }
  }, [finish]);
  const toggle = React.useCallback(async () => {
    if (sendingRef.current) return;
    if (current.current) {
      await finish();
      return;
    }
    const config = latest.current;
    if (!config.api || !config.scopeKey) return;
    const connection = config.api;
    const Stream = (
      AudioModule as unknown as {
        AudioStream?: new (options: {
          sampleRate: number;
          channels: number;
          encoding: string;
        }) => NativeStream;
      }
    ).AudioStream;
    let complete!: Capture["complete"];
    const result = new Promise<string | null>(resolve => { complete = resolve; });
    const state: Capture = {
      text: config.value, provider: "", result, complete,
      offset: 0,
      cancelled: false,
      format: Stream ? "pcm16" : Platform.OS === "ios" ? "wav" : "aac",
    };
    current.current = state;
    setMode("connecting");
    config.onStatus("Connecting live dictation…");
    const valid = () =>
      current.current === state &&
      !state.cancelled &&
      latest.current.scopeKey === config.scopeKey;
    state.setup = (async () => {
      try {
        await pendingCleanup.current;
        await speechPreference.load();
        if (!valid()) return;
        const providerMode = speechPreference.getSnapshot();
        if (Platform.OS === "ios" || Platform.OS === "android") {
          state.screenAwake = holdDictationScreenAwake();
          await state.screenAwake.ready;
          if (!valid()) return;
        }
        const permission = await requestRecordingPermissionsAsync();
        if (!valid()) return;
        if (!permission.granted)
          throw new Error("Microphone permission denied.");
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        if (!valid()) return;
        const url = connection.url("/api/asr/stream");
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        state.session = createStreamingAsrSession({
          url: url.toString(),
          format: state.format,
          providerMode,
          onProvider: provider => {
            if (!valid()) return;
            state.provider = provider;
            if (state.ready) latest.current.onStatus(asrStatus(state.stopping ? "finishing" : "recording", provider));
          },
          createSocket: (url) =>
            new NativeWebSocket(url, undefined, {
              headers: { Authorization: `Bearer ${connection.token}` },
            }),
          onTranscript: (text) => {
            if (valid()) {
              state.text = dictationText(config.value, text);
              latest.current.onChangeText(state.text);
            }
          },
          onEnd: (error) => {
            if (!valid()) return;
            void cleanup(state).then(() => {
              if (!valid()) return;
              current.current = null;
              setMode("idle");
              latest.current.onStatus(error || asrStatus("done", state.provider));
              state.complete(error ? null : state.text);
            });
          },
        });
        await state.session.start();
        if (!valid()) return;
        if (Stream) {
          state.stream = new Stream({
            sampleRate: 16000,
            channels: 1,
            encoding: "float32",
          });
          let resample: ReturnType<typeof createPcmResampler> | undefined,
            rate = 0,
            channels = 0;
          state.stream.addListener("audioStreamBuffer", (buffer) => {
            if (!valid() || state.stopping) return;
            try {
              if (!resample) {
                rate = buffer.sampleRate;
                channels = buffer.channels;
                resample = createPcmResampler(rate, channels);
              }
              if (rate !== buffer.sampleRate || channels !== buffer.channels)
                throw new Error(
                  "Microphone format changed. Start live dictation again.",
                );
              state.session!.audio(resample(new Float32Array(buffer.data)));
            } catch (error) {
              state.session?.cancel(
                error instanceof Error
                  ? error.message
                  : "Microphone stream failed.",
              );
            }
          });
          await state.stream.start();
          if (!valid()) return;
        } else {
          // Runtime 6 already has this recorder. AAC ADTS/WAV can be read while
          // recording; never wait for an MP4 footer or restart recording in segments.
          state.recorder = new AudioModule.AudioRecorder({
            ...STREAM_RECORDING_OPTIONS,
            ...(Platform.OS === "ios"
              ? STREAM_RECORDING_OPTIONS.ios
              : STREAM_RECORDING_OPTIONS.android),
          });
          await state.recorder.prepareToRecordAsync(STREAM_RECORDING_OPTIONS);
          if (!valid()) return;
          state.recorder.record();
          state.uri = state.recorder.uri || undefined;
          if (!state.uri)
            throw new Error("Microphone recording is unavailable.");
          state.pump = async () => {
            if (state.reading) return state.reading;
            state.reading = (async () => {
              if (!state.uri || !valid()) return;
              const info = await getInfoAsync(state.uri);
              if (!info.exists) return;
              while (valid() && state.offset < info.size) {
                const encoded = await readAsStringAsync(state.uri, {
                  encoding: EncodingType.Base64,
                  position: state.offset,
                  length: Math.min(32768, info.size - state.offset),
                });
                if (!valid()) return;
                const bytes = toByteArray(encoded);
                if (!bytes.length) break;
                state.offset += bytes.length;
                state.session!.audio(
                  bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                  ) as ArrayBuffer,
                );
              }
            })();
            try {
              await state.reading;
            } finally {
              state.reading = undefined;
            }
          };
          state.timer = setInterval(() => {
            void state.pump!().catch(() => {
              state.session?.cancel(
                "Could not read microphone audio. Your current text was kept.",
              );
            });
          }, 150);
        }
        state.ready = true;
        setMode("recording");
        latest.current.onStatus(asrStatus("recording", state.provider));
      } catch (error) {
        if (valid()) {
          cancel();
          setMode("idle");
          latest.current.onStatus(
            error instanceof Error ? error.message : "Live dictation failed.",
          );
        }
      }
    })();
    await state.setup;
    if (!valid()) void cleanup(state);
  }, [cancel, cleanup, finish]);
  return {
    mode,
    active: mode !== "idle",
    busy: mode === "connecting" || mode === "finishing",
    toggle,
    submit,
    sending,
  };
}
