import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
const source = stripTypeScriptTypes(await readFile(new URL('../src/input-composer.ts', import.meta.url), 'utf8'))
  .replace("'../../../public/streaming-asr.js'", JSON.stringify(new URL('../../../public/streaming-asr.js', import.meta.url).href))
  .replace("'./dictation-input'", JSON.stringify('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(await readFile(new URL('../src/dictation-input.ts', import.meta.url), 'utf8'))).toString('base64')));
const { installInputComposer } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const tick = () => new Promise(resolve => setImmediate(resolve));
class Element extends EventTarget {
  value = ''; hidden = false; disabled = false; readOnly = false;
  dataset = {}; attributes = {}; classList = { add() {}, toggle() {} };
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  focus() { document.activeElement = this; }
}
class Socket {
  static instances = [];
  readyState = 1; bufferedAmount = 0; sent = [];
  constructor(url) { this.url = url; Socket.instances.push(this); queueMicrotask(() => this.onopen?.()); }
  send(value) { this.sent.push(value); }
  close() { this.readyState = 3; this.onclose?.(); }
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const connection = () => ({ connect() { return this; }, disconnect() {} });
let microphone, track, calls;
const stream = () => {
  track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const ownTrack = track;
  return { getTracks: () => [ownTrack] };
};
globalThis.AudioContext = class {
  sampleRate = 48000; audioWorklet = { addModule: async () => {} }; destination = {};
  async resume() {} async close() {}
  createMediaStreamSource() { return connection(); }
  createGain() { return { ...connection(), gain: { value: 0 } }; }
};
class Worklet {
  static instance;
  port = { postMessage: message => { this.pending = message; } };
  constructor() { Worklet.instance = this; }
  connect() { return connection(); } disconnect() {}
}
globalThis.AudioWorkletNode = Worklet;
globalThis.WebSocket = Socket;
globalThis.location = { href: 'https://share.example/s/test', protocol: 'https:' };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
  getUserMedia: () => { calls++; return microphone || Promise.resolve(stream()); },
} } });
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
function fixture({ sessionId = 'share-a', store = storage() } = {}) {
  const elements = Object.fromEntries(['input-open', 'dictation', 'dictation-input', 'dictation-toggle', 'dictation-insert', 'dictation-clear', 'dictation-status'].map(id => [id, new Element()]));
  globalThis.document = new EventTarget();
  document.querySelector = selector => elements[selector.slice(1)];
  document.hidden = false;
  globalThis.window = new EventTarget();
  window.AudioWorkletNode = Worklet;
  globalThis.sessionStorage = store;
  globalThis.localStorage = storage();
  microphone = undefined; calls = 0;
  let writable = true, accept = true, allowed = true;
  const sent = [], enter = [];
  const composer = installInputComposer({ sessionId, writable: () => writable,
    streamUrl: () => `/api/session/${sessionId}/asr?token=capability&viewerToken=viewer`,
    shortcutsAllowed: () => allowed,
    insert: (text, sendEnter) => { if (!accept) return false; sent.push(text); enter.push(sendEnter); return true; },
  });
  const f = { composer, sent, enter, store, elements, allowShortcuts(value) { allowed = value; }, open: elements['input-open'], panel: elements.dictation,
    input: elements['dictation-input'], voice: elements['dictation-toggle'], insert: elements['dictation-insert'],
    type(text) { this.input.value = text; this.input.dispatchEvent(new Event('input')); },
    writable(value) { writable = value; composer.refresh(); },
    accept(value) { accept = value; },
    async record() {
      this.voice.click(); await tick();
      const ws = Socket.instances.at(-1);
      ws.message({ type: 'ready' }); await tick();
      assert.equal(this.voice.dataset.streamingState, 'recording');
      return ws;
    },
  };
  return f;
}
const transcript = (ws, text) => ws.message({ type: 'transcript', text, final: false });
async function finish(ws, text) {
  Worklet.instance.port.onmessage({ data: { done: true } });
  ws.message({ type: 'transcript', text, final: true });
  ws.message({ type: 'done' }); await tick();
}

test('toolbar opens existing draft without recording; close and IME-safe Escape preserve text and focus', () => {
  const f = fixture();
  assert.equal(f.panel.hidden, true);
  f.open.click(); assert.equal(f.panel.hidden, false);
  assert.equal(f.open.attributes['aria-expanded'], 'true');
  assert.equal(document.activeElement, f.input);
  assert.equal(calls, 0);
  f.type('中文 draft');
  const escape = composing => {
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: 'Escape', isComposing: composing });
    f.panel.dispatchEvent(event); return event;
  };
  assert.equal(escape(true).defaultPrevented, false);
  assert.equal(f.panel.hidden, false);
  document.dispatchEvent(new Event('compositionstart'));
  assert.equal(escape(false).defaultPrevented, false);
  document.dispatchEvent(new Event('compositionend'));
  assert.equal(escape(false).defaultPrevented, true);
  assert.equal(f.panel.hidden, true);
  assert.equal(document.activeElement, f.open);
  f.open.click(); assert.equal(f.input.value, '中文 draft');
  assert.equal(calls, 0);
});

test('Insert sends sanitized text once, without Enter, and clears only an accepted draft', async () => {
  const f = fixture(); f.open.click(); f.type('echo 中文\nsecond\tline\x1b\r\x03');
  f.accept(false); f.insert.click(); await tick();
  assert.equal(f.sent.length, 0); assert.notEqual(f.input.value, '');
  f.accept(true); f.insert.click(); f.insert.click(); await tick();
  assert.deepEqual(f.sent, ['echo 中文 second line ']);
  assert.equal(f.input.value, '');
  assert.equal(f.store.getItem('tmax.share.draft.share-a'), undefined);
  assert.equal(f.insert.disabled, true);
});

test('draft survives pagehide/reload, is isolated by share, and storage failure is harmless', () => {
  const store = storage(); let f = fixture({ store });
  f.open.click(); f.type('保留草稿'); window.dispatchEvent(new Event('pagehide'));
  f = fixture({ sessionId: 'share-b', store });
  assert.equal(f.input.value, '');
  f = fixture({ store }); assert.equal(f.input.value, '保留草稿');
  f.elements['dictation-clear'].click();
  f = fixture({ store }); assert.equal(f.input.value, '');
  const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } };
  f = fixture({ store: blocked }); f.open.click(); f.type('in memory'); f.open.click(); f.open.click();
  assert.equal(f.input.value, 'in memory');
});

test('read-only links can reveal input but cannot type, record or insert; control restoration enables it', async () => {
  const f = fixture(); f.writable(false); f.open.click();
  assert.equal(f.panel.hidden, false); assert.equal(f.input.readOnly, true);
  assert.equal(f.voice.disabled, true); assert.equal(f.insert.disabled, true);
  f.voice.click(); f.insert.click(); await tick(); assert.equal(calls, 0); assert.deepEqual(f.sent, []);
  f.writable(true); assert.equal(f.input.readOnly, false); assert.equal(f.voice.disabled, false);
});

test('all existing provider modes use the share-scoped channel; Stop only updates the local draft', async () => {
  for (const provider of ['auto', 'doubao', 'wetype', 'gemini']) {
    const f = fixture(); localStorage.setItem('tmux-mobile.asr-provider.v1', provider);
    f.open.click(); f.type('Base'); const ws = await f.record();
    assert.match(ws.url, /^wss:\/\/share.example\/api\/session\/share-a\/asr\?token=capability&viewerToken=viewer$/);
    assert.equal(JSON.parse(ws.sent[0]).providerMode, provider);
    transcript(ws, 'partial'); assert.equal(f.input.value, 'Base partial');
    assert.match(f.elements['dictation-status'].textContent, /or Insert$/);
    assert.equal(f.input.readOnly, true);
    f.voice.click(); assert.equal(track.readyState, 'ended');
    await finish(ws, 'corrected');
    assert.equal(f.input.value, 'Base corrected'); assert.deepEqual(f.sent, []);
    assert.equal(f.input.readOnly, false); assert.equal(f.insert.disabled, false);
  }
});

test('Insert waits for final correction and submits at most once', async () => {
  const f = fixture(); f.open.click(); const ws = await f.record(); transcript(ws, 'partial');
  f.insert.click(); f.insert.click(); assert.equal(track.readyState, 'ended'); assert.deepEqual(f.sent, []);
  await finish(ws, '最终稿');
  assert.deepEqual(f.sent, ['最终稿']); assert.equal(f.input.value, '');
});

test('close, control loss, hidden page and pagehide cancel recording and pending insert, retaining only the current share draft', async () => {
  for (const reason of ['close', 'control', 'hidden', 'pagehide']) {
    const f = fixture(); f.open.click(); const ws = await f.record(); transcript(ws, 'latest draft');
    f.insert.click();
    if (reason === 'close') f.open.click();
    if (reason === 'control') f.writable(false);
    if (reason === 'hidden') { document.hidden = true; document.dispatchEvent(new Event('visibilitychange')); }
    if (reason === 'pagehide') window.dispatchEvent(new Event('pagehide'));
    assert.equal(track.readyState, 'ended', reason);
    assert.equal(ws.readyState, 3, reason);
    transcript(ws, 'late result'); ws.message({ type: 'done' }); await tick();
    assert.equal(f.input.value, 'latest draft', reason); assert.deepEqual(f.sent, [], reason);
    assert.equal(f.store.getItem('tmax.share.draft.share-a'), 'latest draft');
    const other = fixture({ sessionId: 'share-b', store: f.store });
    transcript(ws, 'must not cross sessions'); assert.equal(other.input.value, '');
  }
});

test('closing while microphone permission is pending releases a late stream without opening ASR', async () => {
  const f = fixture(); f.open.click(); f.type('keep');
  let grant; microphone = new Promise(resolve => { grant = resolve; });
  const count = Socket.instances.length; f.voice.click(); f.open.click();
  grant(stream()); await tick();
  assert.equal(track.readyState, 'ended'); assert.equal(Socket.instances.length, count);
  assert.equal(f.input.value, 'keep'); assert.equal(f.panel.hidden, true);
});

const shortcut = (code, extra = {}) => {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { code, key: code === 'Enter' ? 'Enter' : code.slice(-1), altKey: true, shiftKey: true, ...extra });
  document.dispatchEvent(event); return event;
};
test('keyboard opens from terminal focus, records/stops and sends final text plus Enter once', async () => {
  const f = fixture(); const terminal = new Element(); terminal.focus();
  assert(shortcut('KeyX').defaultPrevented); assert.equal(document.activeElement, f.input);
  f.type('base');
  shortcut('KeyR'); await tick(); const ws = Socket.instances.at(-1); ws.message({type:'ready'}); await tick();
  transcript(ws,'partial');
  shortcut('KeyR'); assert.equal(track.readyState,'ended'); assert.deepEqual(f.sent,[]);
  shortcut('Enter'); shortcut('Enter',{repeat:true}); shortcut('Enter');
  await finish(ws,'final');
  assert.deepEqual(f.sent,['base final']); assert.deepEqual(f.enter,[true]);
  assert.equal(f.elements['dictation-status'].textContent,'Text sent with Enter');
});
test('keyboard send ignores IME/repeats/normal keys/dialogs and never sends through control loss', async () => {
  const f=fixture();
  assert(!shortcut('KeyX',{isComposing:true}).defaultPrevented);assert(f.panel.hidden);
  document.dispatchEvent(new Event('compositionstart'));
  assert(!shortcut('KeyX').defaultPrevented);document.dispatchEvent(new Event('compositionend'));
  assert(!shortcut('KeyX',{keyCode:229}).defaultPrevented);
  document.dispatchEvent(new Event('compositionstart'));
  window.dispatchEvent(new Event('pagehide'));
  assert(shortcut('KeyX').defaultPrevented, 'navigation clears stale composition');
  assert(!shortcut('KeyX',{altKey:false}).defaultPrevented);
  assert(!shortcut('KeyX',{ctrlKey:true}).defaultPrevented);
  f.allowShortcuts(false);assert(!shortcut('KeyX').defaultPrevented);f.allowShortcuts(true);
  shortcut('KeyX');f.type('draft');
  assert(!shortcut('Enter',{altKey:false,shiftKey:false}).defaultPrevented);
  shortcut('Enter',{repeat:true});await tick();assert.deepEqual(f.sent,[]);
  f.writable(false);shortcut('Enter');shortcut('KeyR');await tick();assert.equal(calls,0);assert.deepEqual(f.sent,[]);
  f.writable(true); const ws=await f.record(); transcript(ws,'partial');
  shortcut('Enter');f.writable(false);await finish(ws,'late final');
  assert.deepEqual(f.sent,[]);assert.equal(f.input.value,'draft partial');
});
test('keyboard Send cancelled by closing or pagehide cannot fire later, and Insert stays text-only', async () => {
  for(const reason of ['close','pagehide']){
    const f=fixture();shortcut('KeyX');const ws=await f.record();transcript(ws,'keep');shortcut('Enter');
    if(reason==='close')f.open.click();else window.dispatchEvent(new Event('pagehide'));
    await finish(ws,'late');assert.deepEqual(f.sent,[]);assert.equal(f.input.value,'keep');
  }
  const f=fixture();shortcut('KeyX');f.type('typed');f.insert.click();await tick();
  assert.deepEqual(f.enter,[false]);
});
