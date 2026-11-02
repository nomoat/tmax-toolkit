import assert from 'node:assert/strict';
import { it } from 'vitest';
import { ASR_PREFERENCE_KEY, createAsrPreference, normalizeAsrMode, asrStatus } from './asr-provider';
it('persists the selected speech service and handles failed writes and late reads', async () => {

assert.equal(normalizeAsrMode('invalid'), 'auto');
assert.equal(asrStatus('recording', 'wetype'), 'Listening · WeChat · Stop to finish, or Send');
let stored = 'wetype', fail = false;
const storage = { async getItem(key: string) { assert.equal(key, ASR_PREFERENCE_KEY); return stored; }, async setItem(key: string, value: string) { assert.equal(key, ASR_PREFERENCE_KEY); if (fail) throw new Error('full'); stored = value; } };
const preference = createAsrPreference(storage);
await preference.load(); assert.equal(preference.getSnapshot(), 'wetype');
await preference.setMode('doubao');
const restarted = createAsrPreference(storage); await restarted.load(); assert.equal(restarted.getSnapshot(), 'doubao');
fail = true; await assert.rejects(preference.setMode('wetype')); assert.equal(preference.getSnapshot(), 'doubao');
fail = false; await preference.setMode('auto'); assert.equal(stored, 'auto');
// @ts-expect-error invalid persisted input
await assert.rejects(preference.setMode('unknown')); assert.equal(stored, 'auto');
let finishRead!: (value: string) => void;
const raced = createAsrPreference({ ...storage, getItem: () => new Promise(resolve => { finishRead = resolve; }) });
const pending = raced.load(); await raced.setMode('wetype'); finishRead('doubao'); await pending;
assert.equal(raced.getSnapshot(), 'wetype');
await Promise.all([preference.setMode('doubao'), preference.setMode('wetype')]); assert.equal(stored, 'wetype');
});
