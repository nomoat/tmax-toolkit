import assert from 'node:assert/strict';
import { activityFromTranscript, readPaneActivity } from './tmax-activity.mjs';
import { latestActivityTime } from '../../tmux-mobile/public/session-groups.js';

const info = { turns: [
  { role: 'assistant', t: '2026-11-01T12:00:00Z' },
  { role: 'user', t: '2026-11-02T12:00:00Z' },
  { role: 'assistant', t: 'invalid' },
] };
assert.equal(activityFromTranscript(info, latestActivityTime), Date.parse('2026-11-02T12:00:00Z'));
assert.equal(activityFromTranscript(null, latestActivityTime), null);
assert.equal(activityFromTranscript({ turns: [{ role: 'assistant' }] }, latestActivityTime), null);

let kind = 'claude';
let exact = { sessionId: 'owned-session' };
let readExact = info;
let fallback = { ...info, kind: 'claude', sessionId: 'different-session' };
let fallbackCalls = 0;
const modules = {
  latestActivityTime,
  metadata: { detectCommandCenterAgentType: () => kind },
  backend: {
    foregroundPaneProcesses: p => p,
    findClaudeSessionFromBackend: async () => exact,
    readClaudeTranscriptFromSession: async () => readExact,
    localBackend: { agentTranscript: async () => { fallbackCalls++; return fallback; } },
  },
};
const pane = { pane_id: '%1', pid: 123, cwd: '/same-worktree', command: 'node', title: '' };
assert.equal((await readPaneActivity(pane, [], modules)).at_ms, Date.parse('2026-11-02T12:00:00Z'));
assert.equal(fallbackCalls, 0, 'exact Claude ownership wins');
readExact = null;
assert.equal((await readPaneActivity(pane, [], modules)).at_ms, null, 'another session must never donate its time');
exact = null;
kind = 'pi';
fallback = { ...info, kind: 'pi', sessionId: 'pi-session' };
assert.equal((await readPaneActivity(pane, [], modules)).source, 'conversation');
kind = null;
const calls = fallbackCalls;
assert.deepEqual(await readPaneActivity(pane, [], modules), { pane_id: '%1', pid: 123, source: 'terminal', at_ms: null });
assert.equal(fallbackCalls, calls, 'ordinary shells do not read agent histories');
console.log('T-MAX activity parity and pane ownership tests passed');
