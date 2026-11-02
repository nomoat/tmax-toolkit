import { describe, it, expect } from "vitest";
import {
  createStreamingAsrSession,
  dictationText,
  createPcmResampler,
} from "./streaming-asr-session";
class FakeSocket {
  readyState = 0;
  bufferedAmount = 0;
  sent: Array<string | ArrayBuffer> = [];
  onopen = () => {};
  onmessage = (_e: { data: string }) => {};
  onerror = () => {};
  onclose = () => {};
  send(value: string | ArrayBuffer) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
    this.onclose();
  }
  open() {
    this.readyState = 1;
    this.onopen();
  }
  message(value: unknown) {
    this.onmessage({ data: JSON.stringify(value) });
  }
}
describe("streaming dictation", () => {
  it("sends the selected service and reports the actual service, including fallback events", async () => {
    const socket = new FakeSocket(), providers: string[] = [];
    const session = createStreamingAsrSession({ url: "wss://controller/api/asr/stream", providerMode: "wetype",
      createSocket: () => socket as unknown as WebSocket, onProvider: provider => providers.push(provider) });
    const ready = session.start(); socket.open();
    expect(JSON.parse(socket.sent[0] as string).providerMode).toBe("wetype");
    socket.message({ type: "provider", provider: "wetype" }); socket.message({ type: "ready" }); await ready;
    socket.message({ type: "provider", provider: "invalid" });
    socket.message({ type: "transcript", provider: "doubao", text: "hello" });
    expect(providers).toEqual(["wetype", "doubao"]); session.cancel();
  });
  it("replaces interim text, keeps the original draft and accepts final corrections", async () => {
    const socket = new FakeSocket(),
      texts: string[] = [],
      errors: Array<string | undefined> = [];
    const session = createStreamingAsrSession({
      url: "wss://controller/api/asr/stream",
      createSocket: () => socket as unknown as WebSocket,
      onTranscript: (t) => texts.push(dictationText("Existing draft", t)),
      onEnd: (e) => errors.push(e),
    });
    const ready = session.start();
    socket.open();
    expect(JSON.parse(socket.sent[0] as string)).toEqual({
      type: "start",
      format: "pcm16",
    });
    socket.message({ type: "ready" });
    await ready;
    socket.message({ type: "transcript", text: "hello", final: false });
    socket.message({ type: "transcript", text: "Hello world.", final: true });
    expect(texts).toEqual([
      "Existing draft hello",
      "Existing draft Hello world.",
    ]);
    session.finish();
    expect(JSON.parse(socket.sent.at(-1) as string)).toEqual({
      type: "finish",
    });
    socket.message({ type: "done" });
    session.cancel();
    expect(errors).toEqual([undefined]);
    socket.message({ type: "transcript", text: "late" });
    expect(texts).toHaveLength(2);
  });
  it("retains the error and ignores late transcripts after cancellation or a scope change", async () => {
    const socket = new FakeSocket(),
      texts: string[] = [],
      errors: Array<string | undefined> = [];
    const session = createStreamingAsrSession({
      url: "wss://controller/api/asr/stream",
      createSocket: () => socket as unknown as WebSocket,
      onTranscript: (t) => texts.push(t),
      onEnd: (e) => errors.push(e),
    });
    const ready = session.start();
    socket.open();
    socket.message({ type: "ready" });
    await ready;
    session.cancel("Microphone failed");
    socket.message({ type: "transcript", text: "wrong session" });
    expect(texts).toEqual([]);
    expect(errors).toEqual(["Microphone failed"]);
  });
  it("bounds queued audio instead of accumulating a whole recording", async () => {
    const socket = new FakeSocket(),
      errors: Array<string | undefined> = [];
    const session = createStreamingAsrSession({
      url: "wss://controller/api/asr/stream",
      createSocket: () => socket as unknown as WebSocket,
      onEnd: (e) => errors.push(e),
    });
    const ready = session.start();
    socket.open();
    socket.message({ type: "ready" });
    await ready;
    session.audio(new ArrayBuffer(65536));
    expect(
      socket.sent
        .filter((x) => x instanceof ArrayBuffer)
        .map((x) => (x as ArrayBuffer).byteLength),
    ).toEqual([32768, 32768]);
    socket.bufferedAmount = 300000;
    session.audio(new ArrayBuffer(3200));
    expect(errors[0]).toMatch(/too slow/);
  });
  it("resamples hardware-rate stereo audio continuously to signed 16kHz mono PCM", () => {
    const convert = createPcmResampler(48000, 2);
    const output = new DataView(
      convert(new Float32Array([1, -1, 1, -1, 1, -1, 1, 1, 1, 1, 1, 1])),
    );
    expect(output.byteLength).toBe(4);
    expect(output.getInt16(0, true)).toBe(0);
    expect(output.getInt16(2, true)).toBe(32767);
  });
});
