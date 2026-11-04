import { EventEmitter } from "node:events";
import { FreeAsrSession } from "./free-asr.mjs";
import { WeTypeAsrSession } from "./wetype-asr.mjs";
import { GeminiAsrSession } from "./gemini-asr.mjs";

export const PROVIDERS = { doubao: FreeAsrSession, wetype: WeTypeAsrSession, gemini: GeminiAsrSession };

// Keep one bounded in-memory PCM copy until completion so each provider can
// replay the utterance after a failure. No client reconnect or microphone restart.
export class FailoverAsrSession extends EventEmitter {
  constructor({ deviceId, geminiApiKey, providers = ["doubao", "wetype", ...(geminiApiKey ? ["gemini"] : [])], createProvider = (name, options) => new PROVIDERS[name](options), connectMs = 5000, finishMs = 6000, geminiConnectMs = 10000, geminiFinishMs = 15000 }) {
    super();
    this.options = { deviceId };
    this.geminiApiKey = geminiApiKey;
    this.providers = [...new Set(providers)];
    if (!this.providers.length || this.providers.some((name) => !PROVIDERS[name])) throw new Error("Invalid speech provider");
    this.createProvider = createProvider;
    this.connectMs = connectMs;
    this.finishMs = finishMs;
    this.geminiConnectMs = geminiConnectMs;
    this.geminiFinishMs = geminiFinishMs;
    this.attempt = -1;
    this.audioChunks = [];
    this.size = 0;
    this.textLength = 0;
  }
  start() { this.next(); }
  next() {
    if (this.closed) return;
    this.disconnect();
    this.attempt++;
    this.cursor = 0;
    this.offset = 0;
    this.providerReady = false;
    this.finishSent = false;
    if (this.attempt >= this.providers.length) {
      this.close();
      const service = this.providers.length > 2 ? "All speech services are" : this.providers.length > 1 ? "Both speech services are" : `${{ wetype: 'WeChat', doubao: 'Doubao', gemini: 'Gemini' }[this.providers[0]]} speech is`;
      this.emit("error", new Error(`${service} unavailable. Your current text was kept; please try again.`));
      return;
    }
    const name = this.providers[this.attempt];
    try {
      const provider = this.createProvider(name, name === 'gemini' ? { ...this.options, apiKey: this.geminiApiKey, connectMs: this.geminiConnectMs, finishMs: this.geminiFinishMs } : this.options);
      this.provider = provider;
      const current = () => !this.closed && this.provider === provider;
      provider.on("error", () => { if (current()) this.next(); });
      provider.on("ready", () => {
        if (!current() || this.providerReady) return;
        clearTimeout(this.timer);
        this.providerReady = true;
        if (!this.ready) { this.ready = true; this.emit("ready"); }
        this.emit("provider", { provider: name, fallback: this.attempt > 0 });
        queueMicrotask(() => this.pump());
      });
      provider.on("transcript", (result) => {
        if (!current()) return;
        // During replay keep the old partial until the replacement catches up.
        if (this.attempt && !result.final && result.text.length < this.textLength) return;
        this.textLength = result.text.length;
        this.emit("transcript", { ...result, provider: name });
      });
      provider.on("done", () => {
        if (!current()) return;
        this.close();
        this.emit("done");
      });
      this.timer = setTimeout(() => this.next(), name === 'gemini' ? this.geminiConnectMs : this.connectMs);
      provider.start();
    } catch { this.next(); }
  }
  audio(data) {
    if (this.closed || this.finishing) return;
    if (data.length % 2) throw new Error("Invalid PCM audio");
    this.size += data.length;
    if (this.size > 20 * 1024 * 1024) throw new Error("Streaming audio is too long");
    if (data.length) this.audioChunks.push(Buffer.from(data));
    this.pump();
  }
  pump() {
    if (this.closed || !this.providerReady || this.pumping) return;
    clearTimeout(this.pumpTimer);
    this.pumping = true;
    const provider = this.provider;
    try {
      // Yield after 100 ms of PCM. Respect encoder/socket backpressure on replay.
      if (this.cursor < this.audioChunks.length && provider.writable !== false) {
        const chunk = this.audioChunks[this.cursor], end = Math.min(this.offset + 3200, chunk.length);
        const data = chunk.subarray(this.offset, end);
        this.offset = end;
        if (end === chunk.length) { this.cursor++; this.offset = 0; }
        provider.audio(data);
      }
      if (this.provider !== provider || this.closed) return;
      if (this.cursor < this.audioChunks.length) this.pumpTimer = setTimeout(() => this.pump(), 1);
      else if (this.finishing && !this.finishSent) {
        this.finishSent = true;
        this.timer = setTimeout(() => this.next(), this.providers[this.attempt] === 'gemini' ? this.geminiFinishMs : this.finishMs);
        provider.finish();
      }
    } catch { this.next(); }
    finally { this.pumping = false; }
  }
  finish() {
    if (this.closed || this.finishing) return;
    this.finishing = true;
    this.pump();
  }
  disconnect() {
    clearTimeout(this.timer);
    clearTimeout(this.pumpTimer);
    const provider = this.provider;
    this.provider = null;
    provider?.close();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.disconnect();
    this.audioChunks = [];
    this.geminiApiKey = undefined;
  }
}
