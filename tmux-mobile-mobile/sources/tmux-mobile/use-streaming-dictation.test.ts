import * as React from 'react';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  platform: 'android', available: true,
  listeners: {} as Record<string, (event: never) => void>,
  start: vi.fn(), stop: vi.fn(), release: vi.fn(),
  legacy: vi.fn(), recorder: vi.fn(), audioMode: vi.fn(),
  permission: vi.fn(), statuses: vi.fn(), text: vi.fn(),
  session: { start: vi.fn(), cancel: vi.fn(), audio: vi.fn(), finish: vi.fn() },
  sessionOptions: null as null | { onTranscript: (text: string) => void; onEnd: (error?: string) => void },
}));
vi.mock('react-native', () => ({ AppState: {}, Platform: { get OS() { return capture.platform; } } }));
vi.mock('expo', () => ({ requireOptionalNativeModule: () => capture.available ? {
  builtInOnly: true,
  PhoneMicrophoneStream: class {
    start = capture.start; stop = capture.stop; release = capture.release;
    addListener(name: string, callback: (event: never) => void) {
      capture.listeners[name] = callback;
      return { remove() {} };
    }
  },
} : null }));
vi.mock('expo-audio', () => ({
  AudioModule: { AudioStream: capture.legacy, AudioRecorder: capture.recorder },
  requestRecordingPermissionsAsync: capture.permission, setAudioModeAsync: capture.audioMode,
}));
vi.mock('expo-file-system/legacy', () => ({
  getInfoAsync: vi.fn(), readAsStringAsync: vi.fn(), deleteAsync: vi.fn(), EncodingType: {},
}));
vi.mock('./dictation-screen-awake', () => ({
  holdDictationScreenAwake: () => ({ ready: Promise.resolve(), release: () => Promise.resolve() }),
}));
vi.mock('./speech-preference', () => ({ speechPreference: { load: vi.fn(), getSnapshot: () => 'free' } }));
vi.mock('./streaming-asr-session', async importOriginal => ({
  ...await importOriginal<typeof import('./streaming-asr-session')>(),
  createStreamingAsrSession: (options: NonNullable<typeof capture.sessionOptions>) => {
    capture.sessionOptions = options;
    return capture.session;
  },
}));

import { useStreamingDictation } from './use-streaming-dictation';
import type { TmuxMobileApi } from './api';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

function input() {
  let result!: ReturnType<typeof useStreamingDictation>;
  function Probe() {
    result = useStreamingDictation({
      api: { url: () => new URL('https://example.invalid/api/asr/stream'), token: 'synthetic-test' } as unknown as TmuxMobileApi,
      scopeKey: 'synthetic', value: 'kept', onChangeText: capture.text, onStatus: capture.statuses,
    });
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return result;
}

beforeEach(() => {
  vi.resetAllMocks();
  capture.platform = 'android'; capture.available = true;
  capture.listeners = {}; capture.sessionOptions = null;
  capture.permission.mockResolvedValue({ granted: true });
  capture.start.mockResolvedValue(undefined);
  capture.session.start.mockResolvedValue(undefined);
  capture.session.cancel.mockImplementation((error?: string) => capture.sessionOptions?.onEnd(error));
});

describe('Android microphone capture integration', () => {
  it('uses the phone-only PCM stream without constructing default-routed recorders or changing audio mode', async () => {
    await input().toggle();
    expect(capture.start).toHaveBeenCalledOnce();
    expect(capture.listeners.audioStreamError).toBeTypeOf('function');
    expect(capture.legacy).not.toHaveBeenCalled();
    expect(capture.recorder).not.toHaveBeenCalled();
    expect(capture.audioMode).not.toHaveBeenCalled();
    capture.sessionOptions?.onEnd();
    await new Promise(resolve => setImmediate(resolve));
    expect(capture.stop).toHaveBeenCalledOnce();
    expect(capture.release).toHaveBeenCalledOnce();
  });

  it('rejects an old binary without silently falling back to a Bluetooth-capable recorder', async () => {
    capture.available = false;
    await input().toggle();
    expect(capture.statuses).toHaveBeenLastCalledWith(expect.stringContaining('Install the latest T-MAX Android app'));
    expect(capture.start).not.toHaveBeenCalled();
    expect(capture.legacy).not.toHaveBeenCalled();
    expect(capture.recorder).not.toHaveBeenCalled();
    expect(capture.session.start).not.toHaveBeenCalled();
  });

  it('ends capture on native route failure, releases once and preserves recognized text', async () => {
    await input().toggle();
    capture.sessionOptions?.onTranscript('synthetic words');
    const previous = capture.text.mock.calls.at(-1)?.[0];
    capture.listeners.audioStreamError({ message: 'Phone microphone became unavailable.' } as never);
    await new Promise(resolve => setImmediate(resolve));
    expect(capture.session.cancel).toHaveBeenCalledWith('Phone microphone became unavailable.');
    expect(capture.stop).toHaveBeenCalledOnce();
    expect(capture.release).toHaveBeenCalledOnce();
    expect(capture.text).toHaveBeenCalledOnce();
    expect(capture.text).toHaveBeenLastCalledWith(previous);
    expect(capture.statuses).toHaveBeenLastCalledWith('Phone microphone became unavailable.');
  });

  it('does not start capture after recording permission is denied', async () => {
    capture.permission.mockResolvedValue({ granted: false });
    await input().toggle();
    expect(capture.start).not.toHaveBeenCalled();
    expect(capture.statuses).toHaveBeenLastCalledWith('Microphone permission denied.');
  });
});
