import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { GeminiAsrSession, GEMINI_ASR_MODEL } from '../lib/gemini-asr.mjs';
import { FailoverAsrSession } from '../lib/asr-failover.mjs';
import { asrProviderOrder } from '../lib/streaming-asr.mjs';
class Socket extends EventEmitter {
  static instances = [];
  readyState = 1; bufferedAmount = 0; frames = [];
  constructor(url, options) { super(); this.url = url; this.options = options; Socket.instances.push(this); queueMicrotask(() => this.emit('open')); }
  send(text) { this.frames.push(JSON.parse(text)); }
  terminate() { this.readyState = 3; this.terminated = true; }
  message(value) { this.emit('message', Buffer.from(JSON.stringify(value))); }
}
async function start(options = {}) {
  const session = new GeminiAsrSession({ apiKey: 'private-test-key', Socket, connectMs: 30, finishMs: 30, ...options });
  const texts = [], errors = []; let done = 0;
  session.on('transcript', value => texts.push(value));
  session.on('error', error => errors.push(error.message));
  session.on('done', () => done++);
  session.start(); await delay(0);
  const ws = Socket.instances.at(-1);
  assert(!ws.url.includes('private-test-key')); assert.equal(ws.options.headers['x-goog-api-key'], 'private-test-key');
  assert.equal(ws.frames[0].setup.model, `models/${GEMINI_ASR_MODEL}`);
  assert.equal(ws.frames[0].setup.realtimeInputConfig.automaticActivityDetection.disabled, true);
  ws.message({ setupComplete: {} });
  assert.deepEqual(ws.frames[1], { realtimeInput: { activityStart: {} } });
  return { session, ws, texts, errors, get done() { return done; } };
}
// Single manual activity. Replace hypotheses, retain committed segments, and
// complete only on authoritative transcription after explicit activityEnd.
{
 const f = await start();
 const audio = Buffer.alloc(640, 3); f.session.audio(audio);
 assert.equal(Buffer.from(f.ws.frames.at(-1).realtimeInput.audio.data, 'base64').equals(audio), true);
 f.ws.message({ serverContent: { interimInputTranscription: { text: '草' } } });
 f.ws.message({ serverContent: { interimInputTranscription: { text: '草稿' } } });
 assert.equal(f.texts.at(-1).text, '草稿'); assert.equal(f.done, 0);
 f.ws.message({ serverContent: { inputTranscription: { text: '第一句。' } } });
 f.ws.message({ serverContent: { interimInputTranscription: { text: '第二' } } });
 assert.equal(f.texts.at(-1).text, '第一句。第二'); assert.equal(f.done, 0);
 f.session.finish(); f.session.finish();
 assert.equal(f.ws.frames.filter(x => x.realtimeInput?.activityEnd).length, 1);
 assert.equal(f.done, 0);
 f.ws.message({ serverContent: { turnComplete: true } }); assert.equal(f.done, 0, 'conversational turnComplete is not an ASR final');
 f.ws.message({ serverContent: { inputTranscription: { text: '第二句。' } } });
 assert.deepEqual(f.texts.at(-1), { text: '第一句。第二句。', final: true });
 assert.equal(f.done, 1); assert(f.ws.terminated); assert.equal(f.session.apiKey, undefined);
 f.ws.message({ serverContent: { inputTranscription: { text: '迟到' } } }); assert.equal(f.done, 1);
}
// Missing key, denied/rate-limited/invalid responses, disconnect, goAway and
// bounded timeouts never report success or leak provider bodies/credentials.
{
 const f = new GeminiAsrSession(); const failed = once(f, 'error'); f.start();
 assert.match((await failed)[0].message, /not configured/);
}
for (const fault of ['denied', 'limited', 'goAway', 'disconnect', 'invalid', 'timeout', 'cancel']) {
 const f = await start(); f.session.audio(Buffer.alloc(320)); f.session.finish();
 if (fault === 'denied' || fault === 'limited') f.ws.message({ error: { code: fault === 'denied' ? 403 : 429, message: 'private-test-key' } });
 if (fault === 'goAway') f.ws.message({ goAway: { timeLeft: '0s' } });
 if (fault === 'disconnect') f.ws.emit('close', 1006, 'private-test-key');
 if (fault === 'invalid') f.ws.emit('message', Buffer.from('not json'));
 if (fault === 'cancel') f.session.close();
 await delay(40);
 assert.equal(f.done, 0); assert.equal(f.errors.length, fault === 'cancel' ? 0 : 1);
 assert(!f.errors.join('').includes('private-test-key')); assert(f.ws.terminated);
 f.ws.message({ serverContent: { inputTranscription: { text: 'late' } } }); assert.equal(f.texts.length, 0);
}
{
 const s = new GeminiAsrSession({ apiKey: 'private-test-key', Socket, connectMs: 5 });
 const failure = once(s, 'error'); s.start(); assert.match((await failure)[0].message, /timed out/);
}
assert.deepEqual(asrProviderOrder({providerMode:'auto'}, {geminiAvailable:true}), ['doubao','wetype','gemini']);
assert.deepEqual(asrProviderOrder({providerMode:'gemini'}, {geminiAvailable:true}), ['gemini']);
assert.deepEqual(asrProviderOrder({provider:'wetype'}, {geminiAvailable:true}), ['wetype','doubao','gemini']);
assert.throws(() => asrProviderOrder({providerMode:'gemini'}), /not configured/);
for (const mode of ['doubao','wetype']) assert.deepEqual(asrProviderOrder({providerMode:mode}, {geminiAvailable:true}), [mode]);

// Use the actual Gemini adapter as the third provider and replay the full
// utterance, including audio arriving between failure and readiness.
{
 const made = [], chunks = [Buffer.alloc(8000,1), Buffer.alloc(1000,2)], text = [];
 const session = new FailoverAsrSession({ deviceId:'stable', geminiApiKey:'private-test-key',
   createProvider(name, options) {
     made.push(name);
     if(name==='gemini') return new GeminiAsrSession({...options,Socket});
     assert.equal(options.apiKey,undefined);
     const p = new EventEmitter(); p.start=()=>queueMicrotask(()=>name==='doubao'?p.emit('ready'):p.emit('error',Error('offline')));
     p.audio=()=>{};p.close=()=>{};p.finish=()=>{};p.writable=true;return p;
   } });
 session.on('transcript',v=>text.push(v));
 const ready=once(session,'ready'); session.start();await ready;
 const old=session.provider;session.audio(chunks[0]);
 old.emit('transcript',{text:'已有长草稿',final:false});old.emit('error',Error('lost'));
 session.audio(chunks[1]);session.finish();await delay(5);
 const ws=Socket.instances.at(-1);ws.message({setupComplete:{}});
 await delay(15);
 assert.deepEqual(made,['doubao','wetype','gemini']);
 assert.deepEqual(Buffer.concat(ws.frames.filter(x=>x.realtimeInput?.audio).map(x=>Buffer.from(x.realtimeInput.audio.data,'base64'))),Buffer.concat(chunks));
 old.emit('transcript',{text:'stale',final:true});
 ws.message({serverContent:{interimInputTranscription:{text:'短'}}});assert.equal(text.length,1);
 const done=once(session,'done');ws.message({serverContent:{inputTranscription:{text:'完整最终稿'}}});await done;
 assert.equal(text.at(-1).provider,'gemini');assert.equal(text.at(-1).text,'完整最终稿');
 assert.equal(session.audioChunks.length,0);assert.equal(session.geminiApiKey,undefined);
}
console.log('Gemini ASR: official manual protocol, interim/final, cancellation, safe errors/timeouts and real third-adapter replay passed.');

// Exhaustion, timeout in earlier finalization and cancellation during the third
// connection remain bounded, and explicit Gemini never calls another provider.
for (const mode of ['exhaust', 'cancel', 'finish-timeout', 'explicit']) {
 const made=[];let third;
 const session=new FailoverAsrSession({geminiApiKey:'test',providers:mode==='explicit'?['gemini']:undefined,
  connectMs:5,finishMs:5,geminiConnectMs:10,geminiFinishMs:10,
  createProvider(name){made.push(name);const p=new EventEmitter();p.close=()=>{};p.audio=()=>{};p.writable=true;
   p.start=()=>queueMicrotask(()=>{
    if(name==='gemini'&&mode==='cancel')return;
    if(mode==='finish-timeout')p.emit('ready');else p.emit('error',Error('failed'));
   });
   p.finish=()=>{if(name==='gemini'){p.emit('transcript',{text:'recovered',final:true});p.emit('done');}};
   if(name==='gemini')third=p;return p;
  }});
 let error;session.on('error',e=>{error=e;});
 const ready=mode==='finish-timeout'?once(session,'ready'):null;session.start();
 if(ready){await ready;session.audio(Buffer.alloc(640));const done=once(session,'done');session.finish();await done;}
 else if(mode==='cancel'){await delay(5);session.close();third.emit('ready');third.emit('error',Error('late'));}
 await delay(30);
 assert.deepEqual(made,mode==='explicit'?['gemini']:['doubao','wetype','gemini']);
 assert.equal(Boolean(error),mode==='exhaust'||mode==='explicit');
 if(mode==='exhaust')assert.match(error.message,/All speech services/);
}
console.log('Three-provider exhaustion, final timeouts, explicit selection and third-connection cancellation passed.');
