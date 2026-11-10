import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { restrictWebViewMicrophone } = require('../../plugins/with-android-phone-microphone.js') as {
  restrictWebViewMicrophone: (source: string) => string;
};

describe('embedded Android microphone policy', () => {
  it('denies audio requests before the existing permission-grant path and leaves video handling intact', () => {
    const installed = readFileSync(require.resolve('react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebChromeClient.java'), 'utf8');
    const updated = restrictWebViewMicrophone(installed);
    expect(updated).toMatch(/requestedResource\.equals\(PermissionRequest\.RESOURCE_AUDIO_CAPTURE\)\) \{\s*\/\/ T-MAX[^\n]+\n\s*continue;/);
    expect(updated).toContain('androidPermission = Manifest.permission.CAMERA;');
    expect(updated).toContain('request.grant(');
    expect(restrictWebViewMicrophone(updated)).toBe(updated);
  });
  it('requires review if the dependency permission implementation changes', () => {
    expect(() => restrictWebViewMicrophone('new upstream implementation')).toThrow('Review react-native-webview');
  });
});
