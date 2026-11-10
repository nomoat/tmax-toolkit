import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireOptionalNativeModule } from 'expo';
import { androidPhoneMicrophone } from './phone-microphone';

vi.mock('expo', () => ({ requireOptionalNativeModule: vi.fn() }));
const requireNative = vi.mocked(requireOptionalNativeModule);
beforeEach(() => { vi.resetAllMocks(); });

describe('Android phone-only microphone capability', () => {
  it('uses the native capture that enforces built-in input', () => {
    const Stream = vi.fn();
    requireNative.mockReturnValue({ builtInOnly: true, PhoneMicrophoneStream: Stream });
    expect(androidPhoneMicrophone()).toBe(Stream);
    expect(requireNative).toHaveBeenCalledWith('TmaxMicrophone');
  });
  it.each([null, { builtInOnly: false }, { builtInOnly: true }])('rejects an incompatible binary instead of using default routing: %j', native => {
    requireNative.mockReturnValue(native);
    expect(androidPhoneMicrophone).toThrow('Install the latest T-MAX Android app');
  });
});
