import { requireOptionalNativeModule } from 'expo';

export type MicrophoneBuffer = { data: ArrayBuffer; sampleRate: number; channels: number };
export type MicrophoneStream = {
  start(): Promise<void>;
  stop(): void;
  release(): void;
  addListener(name: 'audioStreamBuffer', callback: (buffer: MicrophoneBuffer) => void): { remove(): void };
  addListener(name: 'audioStreamError', callback: (error: { message: string }) => void): { remove(): void };
};
export type MicrophoneStreamConstructor = new (options: {
  sampleRate: number; channels: number; encoding: string;
}) => MicrophoneStream;

type PhoneMicrophoneModule = {
  builtInOnly: boolean;
  PhoneMicrophoneStream: MicrophoneStreamConstructor;
};

/** Android must never silently fall back to a recorder with system routing. */
export function androidPhoneMicrophone(): MicrophoneStreamConstructor {
  const native = requireOptionalNativeModule<PhoneMicrophoneModule>('TmaxMicrophone');
  if (!native?.builtInOnly || !native.PhoneMicrophoneStream) {
    throw new Error('Install the latest T-MAX Android app to use the phone microphone.');
  }
  return native.PhoneMicrophoneStream;
}
