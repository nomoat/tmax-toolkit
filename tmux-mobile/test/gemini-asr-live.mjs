// Opt-in official API canary. Input must be synthetic 16 kHz mono PCM16.
// CLI: GEMINI_API_KEY from a private environment, never a command argument.
// A server-side probe may import verifyGeminiLive and pass loadReportConfig's
// apiKey in memory instead; no credentials, audio or transcript are logged.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once, EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { GeminiAsrSession, GEMINI_ASR_MODEL } from '../lib/gemini-asr.mjs';
import { FailoverAsrSession } from '../lib/asr-failover.mjs';
export async function verifyGeminiLive({apiKey,pcm,fallback=false}) {
 assert(apiKey,'Existing server Gemini configuration is required');
 assert(pcm.length>0&&pcm.length%2===0&&!pcm.subarray(0,4).equals(Buffer.from('RIFF')),'Use synthetic raw PCM16');
 const attempted=[];
 const session=fallback?new FailoverAsrSession({geminiApiKey:apiKey,createProvider(name,options){
  attempted.push(name);
  if(name==='gemini')return new GeminiAsrSession(options);
  const p=new EventEmitter();p.start=()=>queueMicrotask(()=>p.emit('error',Error('Synthetic provider failure')));p.close=()=>{};return p;
 }}):new GeminiAsrSession({apiKey});
 let firstInterimMs,interims=0,finals=0,started=0,sent=0,failure,done=false;
 session.on('error',e=>{failure=e;});session.on('done',()=>{done=true;});
 session.on('transcript',r=>{if(r.final)finals++;else if(sent<pcm.length){interims++;firstInterimMs??=Date.now()-started;}});
 try{
  const ready=once(session,'ready');session.start();await ready;started=Date.now();
  for(let offset=0;offset<pcm.length;offset+=3200){
   if(failure)throw failure;
   const part=pcm.subarray(offset,offset+3200);session.audio(part);sent+=part.length;
   await delay(Math.max(0,started+sent/32-Date.now()));
  }
  const endedAt=Date.now();session.finish();
  while(!done){if(failure)throw failure;if(Date.now()-endedAt>65000)throw Error('ASR canary deadline exceeded');await delay(20);}
  assert(interims>0,'No interim before audio ended');assert.equal(finals,1);
  if(fallback)assert.deepEqual(attempted,['doubao','wetype','gemini']);
  return {model:GEMINI_ASR_MODEL,fallback,audioMs:pcm.length/32,firstInterimMs,interims,finals,finishMs:Date.now()-endedAt,passed:true};
 }finally{session.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await verifyGeminiLive({apiKey:process.env.GEMINI_API_KEY,pcm:await readFile(process.argv[2]),fallback:process.argv.includes('--fallback')})));}
 catch{console.error('Gemini live canary failed. Check private configuration, model access and fixture.');process.exitCode=1;}
}
