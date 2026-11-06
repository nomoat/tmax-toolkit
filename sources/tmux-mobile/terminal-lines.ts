import type { AnsiLine } from "./ansi";

export type TerminalLineItem = { key: number; line: AnsiLine };
export type TerminalLineState = { rows: TerminalLineItem[]; nextKey: number };

// A capture is a sliding tail, not an array with stable indexes. Match unchanged
// content first so removing the first line does not invalidate every paragraph.
// Duplicate lines consume separate keys; changed lines can reuse an unclaimed
// key at the same position. Keys never contain captured terminal text.
export function reconcileTerminalLines(lines: AnsiLine[], previous: TerminalLineState): TerminalLineState {
  const available = new Map<string, { rows: TerminalLineItem[]; cursor: number }>();
  previous.rows.forEach(row => {
    const pool = available.get(row.line.signature);
    if (pool) pool.rows.push(row);
    else available.set(row.line.signature, { rows: [row], cursor: 0 });
  });
  const claimed = new Set<number>();
  const matches = lines.map(line => {
    const pool = available.get(line.signature);
    const row = pool?.rows[pool.cursor++];
    if (row) claimed.add(row.key);
    return row;
  });
  let nextKey = previous.nextKey;
  const rows = lines.map((line, index) => {
    if (matches[index]) return matches[index];
    const old = previous.rows[index];
    const key = old && !claimed.has(old.key) ? old.key : nextKey++;
    claimed.add(key);
    return { key, line };
  });
  return { rows, nextKey };
}
