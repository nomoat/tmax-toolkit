import { afterEach, describe, expect, it, vi } from 'vitest';
import { TmuxMobileApi } from './api';
import { canShareTerminal, terminalShareUrl } from './terminal-share';
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('expo-file-system/legacy', () => ({ EncodingType: { Base64: 'base64' }, getInfoAsync: vi.fn(), readAsStringAsync: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
const agent = { machineId: 'machine-1', paneId: '%3', windowId: '@2', mux: 'tmux' };
const viewerUrl = 'https://share.xyznot.com/s/11111111-1111-4111-8111-111111111111#viewer-capability';
describe('native terminal sharing', () => {
  it.each([600, 86400, 432000, 604800])('routes a %i-second share to the captured machine and pane with owner authentication', async ttl => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ viewerUrl, ttlSeconds: ttl, allowControl: true }));
    vi.stubGlobal('fetch', fetch);
    const result = await new TmuxMobileApi('https://eng.xyznot.com', 'owner-token').terminalShare(agent, 'start', ttl, true);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://eng.xyznot.com/api/terminal-share');
    expect(init.headers).toMatchObject({ authorization: 'Bearer owner-token', 'x-machine-id': 'machine-1', 'x-mux': 'tmux' });
    expect(JSON.parse(init.body)).toEqual({ action: 'start', paneId: '%3', ttlSeconds: ttl, allowControl: true });
    expect(terminalShareUrl(result)).toBe(viewerUrl);
  });
  it('defaults to 24 hours with control, supports window-only targets and explicit stop', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true })); vi.stubGlobal('fetch', fetch);
    const api = new TmuxMobileApi();
    await api.terminalShare({ machineId: 'm', windowId: '@8' }, 'start');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'start', windowId: '@8', ttlSeconds: 86400, allowControl: true });
    await api.terminalShare(agent, 'stop');
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ action: 'stop', paneId: '%3' });
  });
  it('does not send an unsupported target or over-limit duration', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const api = new TmuxMobileApi();
    expect(canShareTerminal({ ...agent, mux: 'rmux' })).toBe(false);
    expect(canShareTerminal({})).toBe(false);
    expect(() => api.terminalShare({ ...agent, mux: 'rmux' }, 'start')).toThrow('tmux');
    expect(() => api.terminalShare(agent, 'start', 8 * 86400)).toThrow('7 days');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves viewer capability fragments and refuses external or host API links', () => {
    expect(terminalShareUrl({ viewerUrl })).toBe(viewerUrl);
    expect(terminalShareUrl({})).toBeNull();
    for (const bad of ['javascript:alert(1)', 'https://evil.test/s/x#token', viewerUrl.split('#')[0], viewerUrl.replace('/s/', '/api/session/'), viewerUrl.replace('https://', 'https://user:pass@')]) {
      expect(() => terminalShareUrl({ viewerUrl: bad })).toThrow();
    }
  });
  it('surfaces upgrade and authorization errors without manufacturing a link', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: 'Update this machine’s Connector' }, { status: 501 })); vi.stubGlobal('fetch', fetch);
    await expect(new TmuxMobileApi().terminalShare(agent, 'status')).rejects.toThrow('Update this machine');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
