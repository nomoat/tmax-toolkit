// A failed read is not an empty conversation. Keep the last successful read
// only while the pane binding and any confirmed conversation ID still match.
export function createTranscriptSnapshotCache({ maxEntries = 128, maxBytes = 32 * 1024 * 1024 } = {}) {
  const snapshots = new Map();
  let bytes = 0;
  function remove(key) {
    bytes -= snapshots.get(key)?.bytes || 0;
    snapshots.delete(key);
  }
  return (key, binding, incoming) => {
    const prior = snapshots.get(key);
    const same = prior?.binding === binding && prior.info.kind === incoming.kind &&
      (!incoming.sessionId || prior.info.sessionId === incoming.sessionId);
    if (!same || incoming.transcriptStatus === "unbound") remove(key);
    if (["unavailable", "stale"].includes(incoming.transcriptStatus)) {
      if (same) return { ...prior.info, transcriptStatus: "stale", liveState: "unverified" };
      return incoming;
    }
    const info = { ...incoming, transcriptStatus: incoming.transcriptStatus || "fresh",
      transcriptObservedAt: incoming.transcriptObservedAt || Date.now() };
    if (info.sessionId && info.transcriptStatus === "fresh") {
      remove(key);
      const size = Buffer.byteLength(JSON.stringify(info));
      snapshots.set(key, { binding, info, bytes: size });
      bytes += size;
      while (snapshots.size > maxEntries || bytes > maxBytes) remove(snapshots.keys().next().value);
    }
    return info;
  };
}
