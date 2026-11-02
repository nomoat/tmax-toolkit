import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { mkdtemp, mkdir, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { WebSocketServer } from "ws";
import { selectCodexThread, codexItemDialogue, readCodexDaemonHistory, readCodexAppServerTranscript, CODEX_HISTORY_REFRESH_MS } from "../lib/codex-app-server.mjs";
import { localBackend } from "../lib/backend.mjs";

const id = "01a18ee3-ef04-7261-beca-fa55788d19e3";
const other = "01a18ee3-ef04-7261-beca-fa55788d19e31";
const thread = { id, name: "Media Studio", cwd: "/same/cwd", source: "vscode", historyMode: "paginated", status: { type: "active" }, path: "/unread/legacy.jsonl" };
const signals = { cwd: thread.cwd, paneTitle: "⠹ Media Studio | work" };
assert.equal(selectCodexThread([thread], signals), thread);
for (const candidates of [[], [thread, { ...thread, id: "11111111-1111-4111-8111-111111111111" }], [{ ...thread, parentThreadId: id }], [{ ...thread, status: { type: "notLoaded" } }], [{ ...thread, name: "Media Studio extended" }]]) {
  assert.equal(selectCodexThread(candidates, signals), null);
}
for (const bad of [{ cwd: "/other", paneTitle: signals.paneTitle }, { cwd: thread.cwd, paneTitle: "work" }, { cwd: thread.cwd, paneTitle: "Media Stu… | work" }]) assert.equal(selectCodexThread([thread], bad), null);
assert.equal(codexItemDialogue({ item: { type: "reasoning", text: "internal" } }), null);
assert.equal(codexItemDialogue({ item: { type: "commandExecution", text: "output" } }), null);
const user = { item: { id: "user", type: "userMessage", content: [{ type: "text", text: "Hello" }] }, startedAtMs: 1000 };
const assistant = { item: { id: "assistant", type: "agentMessage", text: "你好。" }, completedAtMs: 2000 };
const methods = [];
const history = await readCodexDaemonHistory(async (method, params) => {
  methods.push(method); assert.equal(params.threadId, id);
  return params.cursor ? { data: [user] } : { data: [assistant, { item: { id: "tool", type: "commandExecution" } }], nextCursor: "older" };
}, thread);
assert.deepEqual(history.turns.map(t => t.role), ["user", "assistant"]);
assert.equal(history.turns[1].text, "你好。");
assert.equal(history.turns[0].t, "1970-01-01T00:00:01.000Z");

// Real Unix WebSocket, including the daemon's normal symlink socket layout.
const home = await mkdtemp(path.join(os.tmpdir(), "tmax-codex-"));
const originalHome = process.env.CODEX_HOME;
const server = http.createServer(), wss = new WebSocketServer({ server });
const calls = [];
const realNow = Date.now;
let now = realNow(), responseThread = thread, failHistory = false, failList = false, empty = false;
let holdHistory = false, releaseHistory;
Date.now = () => now;
const tick = () => { now += CODEX_HISTORY_REFRESH_MS + 1; };
wss.on("connection", socket => socket.on("message", bytes => {
  const request = JSON.parse(bytes); calls.push(request.method);
  if (request.method === "initialized") return;
  let result;
  if (request.method === "initialize") result = {};
  else if (request.method === "thread/list") {
    assert.equal(request.params.useStateDbOnly, true, "never repair metadata by scanning historical rollouts");
    if (failList) { socket.send(JSON.stringify({ id: request.id, error: { message: "unavailable" } })); return; }
    result = { data: responseThread ? [responseThread] : [] };
  }
  else if (request.method === "thread/read") result = { thread };
  else if (request.method === "thread/items/list") {
    if (failHistory) { socket.send(JSON.stringify({ id: request.id, error: { message: "unavailable" } })); return; }
    result = { data: empty ? [] : [assistant, user] };
    if (holdHistory) { releaseHistory = () => socket.send(JSON.stringify({ id: request.id, result })); return; }
  }
  else assert.fail(`Unexpected mutation or request: ${request.method}`);
  socket.send(JSON.stringify({ id: request.id, result }));
}));
try {
  await mkdir(path.join(home, "app-server-control"));
  const socketPath = path.join(home, "daemon.sock");
  server.listen(socketPath); await once(server, "listening");
  await symlink(socketPath, path.join(home, "app-server-control", "app-server-control.sock"));
  process.env.CODEX_HOME = home;
  const result = await readCodexAppServerTranscript(signals);
  assert.equal(result.sessionId, id); assert.equal(result.turns.at(-1).text, "你好。");
  assert.equal(result.liveState, "working");
  const count = calls.length;
  await readCodexAppServerTranscript(signals); assert.equal(calls.length, count, "cache avoids repeated daemon scans");
  const integrated = await localBackend.agentTranscript({ rootPid: 101, cwd: thread.cwd, paneTitle: signals.paneTitle, foregroundCommand: "codex",
    processes: [{ pid: 101, ppid: 1, command: "codex" }], openFiles: new Map() });
  assert.equal(integrated.sessionId, id); assert.equal(integrated.turns.length, 2);
  const exact = await readCodexAppServerTranscript({ sessionId: id });
  assert.equal(exact.sessionId, id);
  assert.equal(await readCodexAppServerTranscript({ sessionId: other }), null);
  tick(); failHistory = true;
  const stale = await readCodexAppServerTranscript(signals);
  assert.equal(stale.transcriptStatus, "stale");
  assert.deepEqual(stale.turns, result.turns);
  assert.equal(stale.transcriptObservedAt, result.transcriptObservedAt);
  tick(); failHistory = false; failList = true;
  assert.deepEqual((await readCodexAppServerTranscript(signals)).turns, result.turns, "failed discovery retains the previous reply");
  tick(); failList = false;
  assert.equal((await readCodexAppServerTranscript(signals)).transcriptStatus, "fresh");
  tick(); responseThread = { ...thread, id: "11111111-1111-4111-8111-111111111111" }; failHistory = true;
  const switched = await readCodexAppServerTranscript(signals);
  assert.equal(switched.sessionId, responseThread.id);
  assert.equal(switched.turns.length, 0, "a new conversation never inherits old content even when its read fails");
  tick(); failHistory = false; empty = true;
  assert.equal((await readCodexAppServerTranscript(signals)).turns.length, 0, "a successful empty read is empty");
  tick(); responseThread = null;
  assert.equal((await readCodexAppServerTranscript(signals)).transcriptStatus, "unbound");
  tick(); responseThread = thread; empty = false; holdHistory = true;
  const slow = readCodexAppServerTranscript(signals);
  for (let i = 0; i < 100 && !releaseHistory; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(releaseHistory);
  const beforeOverlap = calls.length;
  tick();
  const overlap = readCodexAppServerTranscript(signals);
  releaseHistory();
  const [a, b] = await Promise.all([slow, overlap]);
  assert.deepEqual(a, b);
  assert.equal(calls.length, beforeOverlap, "slow requests remain single-flight across the TTL");
  await readCodexAppServerTranscript(signals);
  assert.equal(calls.length, beforeOverlap, "TTL starts after completion");
  assert.ok(calls.includes("initialized"));
  assert.ok(calls.every(method => ["initialize", "initialized", "thread/list", "thread/read", "thread/items/list"].includes(method)));
} finally {
  Date.now = realNow;
  if (originalHome === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = originalHome;
  for (const socket of wss.clients) socket.terminate();
  await new Promise(resolve => server.close(resolve)); wss.close();
  await rm(home, { recursive: true, force: true });
}
console.log("Codex daemon: unique live title/cwd, ambiguity rejection, paginated dialogue, no tool/reasoning leakage, Unix socket, caching and read-only integration passed.");
