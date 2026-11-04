import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

export const GEMINI_ASR_MODEL = 'gemini-3.5-transcribe-live';
const ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

// One manual activity per recording: interim hypotheses replace the current
// segment; authoritative inputTranscription commits it. activityEnd requests the
// final segment, not a conversational response or a fixed observation delay.
export class GeminiAsrSession extends EventEmitter {
  constructor({ apiKey, Socket = WebSocket, connectMs = 10000, finishMs = 15000 } = {}) {
    super();
    this.apiKey = apiKey; this.Socket = Socket;
    this.connectMs = connectMs; this.finishMs = finishMs;
    this.committed = ''; this.interim = ''; this.bytes = 0;
  }
  start() {
    if (this.closed || this.ws) return;
    if (!this.apiKey) { this.fail('Gemini speech is not configured on this server.'); return; }
    try {
      // Server-only header: no credential in URLs, emitted errors or client data.
      this.ws = new this.Socket(ENDPOINT, { headers: { 'x-goog-api-key': this.apiKey },
        handshakeTimeout: this.connectMs, maxPayload: 1024 * 1024, perMessageDeflate: false });
      this.timer = setTimeout(() => this.fail('Gemini speech connection timed out.'), this.connectMs);
      this.ws.on('open', () => {
        if (this.closed) return;
        this.send({ setup: { model: `models/${GEMINI_ASR_MODEL}`,
          generationConfig: { responseModalities: ['TEXT'] }, inputAudioTranscription: {},
          realtimeInputConfig: { automaticActivityDetection: { disabled: true } } } });
      });
      this.ws.on('message', bytes => {
        if (this.closed) return;
        try { this.message(JSON.parse(bytes.toString())); }
        catch { this.fail('Invalid Gemini speech response.'); }
      });
      this.ws.on('error', () => this.fail('Gemini speech connection failed.'));
      this.ws.on('close', () => this.fail('Gemini speech disconnected before completion.'));
    } catch { this.fail('Gemini speech connection failed.'); }
  }
  message(message) {
    if (message.error || message.goAway) { this.fail('Gemini speech is unavailable.'); return; }
    if (message.setupComplete && !this.ready) {
      clearTimeout(this.timer); this.ready = true;
      this.send({ realtimeInput: { activityStart: {} } });
      if (!this.closed) this.emit('ready');
    }
    const content = message.serverContent;
    if (!this.ready || !content) return;
    const final = content.inputTranscription;
    if (typeof final?.text === 'string') {
      this.committed += final.text;
      this.interim = '';
      // Manual endpointing yields the authoritative final after activityEnd.
      // A final while recording is a committed segment, not end of recording.
      const done = Boolean(this.finishing);
      this.emit('transcript', { text: this.committed, final: done });
      if (done && !this.closed) { this.close(); this.emit('done'); }
    } else if (typeof content.interimInputTranscription?.text === 'string') {
      this.interim = content.interimInputTranscription.text;
      this.emit('transcript', { text: this.committed + this.interim, final: false });
    }
  }
  send(message) {
    if (this.closed) return;
    try { this.ws.send(JSON.stringify(message)); }
    catch { this.fail('Gemini speech connection failed.'); }
  }
  get writable() { return !this.closed && this.ready && this.ws?.readyState === WebSocket.OPEN && this.ws.bufferedAmount < 64 * 1024; }
  audio(data) {
    if (this.closed || this.finishing) return;
    if (!this.ready || data.length % 2) throw new Error('Invalid Gemini PCM audio');
    this.bytes += data.length;
    if (this.bytes > 20 * 1024 * 1024) throw new Error('Streaming audio is too long');
    if (data.length) this.send({ realtimeInput: { audio: { data: data.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } });
  }
  finish() {
    if (this.closed || this.finishing) return;
    this.finishing = true;
    if (!this.bytes) { this.close(); this.emit('done'); return; }
    this.timer = setTimeout(() => this.fail('Gemini final transcription timed out. Your current text was kept.'), this.finishMs);
    this.send({ realtimeInput: { activityEnd: {} } });
  }
  fail(message) {
    if (this.closed) return;
    this.close(); this.emit('error', new Error(message));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.ws?.terminate();
    this.apiKey = undefined;
    this.committed = this.interim = '';
  }
}
