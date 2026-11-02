import { describe, it, expect } from 'vitest';
import { conversationPath } from './conversation-link';
describe('conversation links', () => {
  it('pins the vendor session rather than a reusable pane/window and includes no credentials', () => {
    const path = conversationPath({machineId:'m:b3duZXI:YWdlbnQ', kind:'codex', agentSessionId:'session-123', paneId:'%1'});
    const url = new URL(path!, 'https://eng.impo.ai');
    expect(url.pathname).toBe('/conversation');
    expect(Object.fromEntries(url.searchParams)).toEqual({ machineId:'m:b3duZXI:YWdlbnQ',kind:'codex',sessionId:'session-123' });
  });
  it('does not create an ambiguous link without a known session', () => {
    expect(conversationPath({machineId:'machine',kind:'claude'})).toBeNull();
  });
});

// Pi uses the same permission-bound conversation route as the other agents.
it('links Pi histories', () => {
  expect(conversationPath({machineId:'machine',kind:'pi',agentSessionId:'pi-session'})).toContain('kind=pi');
});
