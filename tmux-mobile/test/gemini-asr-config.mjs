import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import http from 'node:http';
import WebSocket from 'ws';
import { loadReportConfig, createGeminiSummarizer } from '../lib/progress-reports.mjs';
import { attachStreamingAsr } from '../lib/streaming-asr.mjs';
const apiKey = 'test-only-private-key';
const env = { SESSION_SECRET: 'test-session-secret' };
const config = { apiKey, model: 'gemini-3.8-flash', collectingSince: '2026-10-01T00:00:00Z' };
const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(`tmux-progress-reports\0${env.SESSION_SECRET}`).digest(), iv);
const data = Buffer.concat([cipher.update(JSON.stringify(config)), cipher.final()]);
const bytes = Buffer.from(JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));
const storage = { async get(key) { assert.equal(key,'reports-v1/config.enc.json'); return {bytes}; } };
const loaded = await loadReportConfig(storage,env);
assert.deepEqual(loaded,config);
assert.equal(await loadReportConfig({get:async()=>null},env),null);
await assert.rejects(loadReportConfig(storage,{SESSION_SECRET:'wrong'}));
const direct = await loadReportConfig({get(){throw Error('must not read storage');}},{GEMINI_API_KEY:apiKey,TMUX_MOBILE_REPORT_MODEL:'custom-report-model'});
assert.equal(direct.model,'custom-report-model');
let reportCalled=false;
await createGeminiSummarizer({...loaded,fetchImpl:async(url,options)=>{
 assert(url.endsWith('/models/gemini-3.8-flash:generateContent'));assert.equal(options.headers['x-goog-api-key'],apiKey);reportCalled=true;
 return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"sessions":[]}'}]}}]})};
}})([],'hourly');assert(reportCalled);
class Speech extends EventEmitter {
 start(){queueMicrotask(()=>{this.emit('ready');this.emit('provider',{provider:'gemini'});});}
 audio(){this.emit('transcript',{text:'Synthetic transcript',provider:'gemini',final:false});}
 finish(){this.emit('transcript',{text:'Synthetic final',provider:'gemini',final:true});this.emit('done');}
 close(){}
}
const server=http.createServer();const requests=[];
let key=loaded.apiKey;
const wss=attachStreamingAsr(server,{authenticate:()=>({userId:'test'}),origin:()=>'',getGeminiApiKey:()=>key,createSession:options=>{requests.push(options);return new Speech();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
async function request(mode,success){
 const ws=new WebSocket(`ws://127.0.0.1:${server.address().port}/api/asr/stream`);const frames=[];
 ws.on('message',bytes=>{const f=JSON.parse(bytes);frames.push(f);if(f.type==='ready')ws.send(JSON.stringify({type:'finish'}));});
 await once(ws,'open');ws.send(JSON.stringify({type:'start',format:'pcm16',providerMode:mode}));await once(ws,'close');
 assert(!JSON.stringify(frames).includes(apiKey));
 assert.equal(frames.at(-1).type,success?'done':'error');return frames;
}
try{
 await request('auto',true);assert.deepEqual(requests.at(-1).providers,['doubao','wetype','gemini']);assert.equal(requests.at(-1).geminiApiKey,apiKey);
 await request('gemini',true);assert.deepEqual(requests.at(-1).providers,['gemini']);
 key='';const frames=await request('gemini',false);assert.match(frames.at(-1).message,/not configured/);
 await request('auto',true);assert.deepEqual(requests.at(-1).providers,['doubao','wetype']);
}finally{for(const c of wss.clients)c.terminate();wss.close();server.close();}
console.log('Gemini configuration: encrypted report key reuse, unchanged report model, missing/invalid config and server-only key passed.');
