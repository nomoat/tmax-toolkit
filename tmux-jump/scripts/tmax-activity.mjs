// Embedded in tmux-jump. Reuse T-MAX's local, read-only transcript readers and
// timestamp comparator; do not maintain a second parser for agent histories.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

export function activityFromTranscript(info, latestActivityTime) {
  const turns = Array.isArray(info?.turns) ? info.turns : [];
  return latestActivityTime({
    lastActivityAt: turns.at(-1)?.t,
    lastUserAt: turns.findLast(t => t.role === 'user')?.t,
    lastAssistantAt: turns.findLast(t => t.role === 'assistant')?.t,
  }) || null;
}

export async function readPaneActivity(pane, processes, modules) {
  const { backend, metadata, latestActivityTime } = modules;
  const { localBackend, foregroundPaneProcesses } = backend;
  const commands = [pane.command, ...foregroundPaneProcesses(processes, pane.pid).map(p => p.command)];
  const kind = metadata.detectCommandCenterAgentType(commands);
  const base = { pane_id: pane.pane_id, pid: pane.pid };
  if (!kind) return { ...base, source: 'terminal', at_ms: null };

  // Match server.mjs safeAgentTranscript: exact Claude PID/session binding
  // precedes fallback discovery, and Pi must keep ownership of its own pane.
  let exact = null;
  let info = null;
  const args = { rootPid: pane.pid, cwd: pane.cwd, processes,
    foregroundCommand: pane.command, paneTitle: pane.title };
  if (kind !== 'pi') {
    try {
      exact = await backend.findClaudeSessionFromBackend(localBackend, args);
      if (exact) info = await backend.readClaudeTranscriptFromSession(localBackend, exact);
    } catch { /* Fall back only with the same identity checks as T-MAX. */ }
  }
  if (!info) {
    try {
      info = await localBackend.agentTranscript(args);
      if (exact && info?.kind === 'claude' && info.sessionId !== exact.sessionId) info = null;
    } catch { /* Missing/unreadable history has no conversation timestamp. */ }
  }
  return { ...base, source: 'conversation', at_ms: activityFromTranscript(info, latestActivityTime) };
}

export async function runWorker(root, input = process.stdin, output = process.stdout, supplied = null) {
  const fromRoot = file => import(pathToFileURL(path.join(root, file)).href);
  const [backend, metadata, { latestActivityTime }] = supplied ? [supplied.backend, supplied.metadata, supplied] : await Promise.all([
    fromRoot('lib/backend.mjs'), fromRoot('lib/window-metadata.mjs'),
    fromRoot('public/session-groups.js'),
  ]);
  const send = value => output.write(JSON.stringify(value) + '\n');
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    try {
      const panes = JSON.parse(line);
      const snapshot = await backend.localBackend.processSnapshot();
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(4, panes.length) }, async () => {
        while (next < panes.length) {
          const pane = panes[next++];
          const processes = backend.processTreeFromSnapshot(snapshot, pane.pid);
          const record = await readPaneActivity(pane, processes, { backend, metadata, latestActivityTime });
          // Stream each result: a slow Codex lookup must not delay other panes.
          // Neither conversation text nor credentials cross this pipe.
          send({ record });
        }
      }));
      send({ done: true });
    } catch (error) {
      send({ done: true, error: String(error.message || error) });
    }
  }
}

if (process.env.TMUX_JUMP_ACTIVITY_WORKER === '1' && process.env.TMUX_JUMP_ACTIVITY_BUNDLED !== '1') {
  runWorker(process.argv[1]).then(() => process.exit(0)).catch(() => {
    process.stdout.write(JSON.stringify({ done: true, error: 'T-MAX activity reader unavailable' }) + '\n');
    process.exit(1);
  });
}
