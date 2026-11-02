import { describe, it, expect, vi, afterEach } from 'vitest';
import { temporaryTerminalsPath, temporaryTerminalNavigationAllowed } from './temporary-terminal-navigation';
import { TmuxMobileApi } from './api';
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('expo-file-system/legacy', () => ({ EncodingType: { Base64: 'base64' } }));
afterEach(() => vi.unstubAllGlobals());
const base = 'https://eng.xyznot.com';
describe('temporary terminal in-app navigation', () => {
  it('preserves the selected machine without inventing a target for All', () => {
    expect(temporaryTerminalsPath('all')).toBe('/temporary-terminals');
    expect(temporaryTerminalsPath()).toBe('/temporary-terminals');
    const url = new URL(temporaryTerminalsPath('m:user@example.com:a&b'), base);
    expect(url.searchParams.get('machineId')).toBe('m:user@example.com:a&b');
    expect([...url.searchParams.keys()]).toEqual(['machineId']);
  });
  it('uses the existing authenticated single-use handoff, not a bearer token in the viewer URL', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ handoffUrl: '/auth/browser-handoff?ticket=once' }));
    vi.stubGlobal('fetch', fetch);
    await new TmuxMobileApi(base, 'device-token').browserHandoff(temporaryTerminalsPath('m1'));
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(base + '/auth/browser-handoff');
    expect(init.headers.authorization).toBe('Bearer device-token');
    expect(JSON.parse(init.body)).toEqual({ returnTo: '/temporary-terminals?machineId=m1' });
  });
  it('permits the controller and our signed share viewer, rejects external pages and host APIs', () => {
    const share = 'https://share.xyznot.com/s/11111111-1111-4111-8111-111111111111#viewer-token';
    for (const url of [base+'/auth/browser-handoff?ticket=once', base+'/temporary-terminals', share, 'about:blank']) expect(temporaryTerminalNavigationAllowed(base, url)).toBe(true);
    for (const url of ['https://evil.example/', share.replace('/s/', '/api/session/'), share.split('#')[0], 'javascript:alert(1)', 'file:///private/key']) expect(temporaryTerminalNavigationAllowed(base, url)).toBe(false);
  });
});
