import { describe, expect, it } from "vitest";
import { reconcileTerminalLines, type TerminalLineState } from "./terminal-lines";
import type { AnsiLine } from "./ansi";

const lines = (...values: string[]): AnsiLine[] => values.map(text => ({ runs: [{ text, style: null }], signature: JSON.stringify(text) }));
const empty = (): TerminalLineState => ({ rows: [], nextKey: 0 });

describe("terminal sliding tail identities", () => {
  it("retains every unchanged paragraph when the capture advances one line", () => {
    const before = reconcileTerminalLines(lines("a", "b", "c"), empty());
    const after = reconcileTerminalLines(lines("b", "c", "d"), before);
    expect(after.rows[0]).toBe(before.rows[1]);
    expect(after.rows[1]).toBe(before.rows[2]);
    expect(after.rows[2].key).not.toBe(before.rows[2].key);
  });

  it("keeps the native paragraph identity for an edited line in place", () => {
    const before = reconcileTerminalLines(lines("a", "b", "c"), empty());
    const after = reconcileTerminalLines(lines("a", "edited", "c"), before);
    expect(after.rows[0]).toBe(before.rows[0]);
    expect(after.rows[1].key).toBe(before.rows[1].key);
    expect(after.rows[1].line.runs[0].text).toBe("edited");
    expect(after.rows[2]).toBe(before.rows[2]);
  });

  it("preserves duplicate lines without duplicate keys or losing their order", () => {
    let state = empty();
    for (const values of [["", "same", "same", ""], ["same", "same", "", "next"], ["", "next", "", "same"], ["same", "same", "same", "same"]]) {
      state = reconcileTerminalLines(lines(...values), state);
      expect(new Set(state.rows.map(row => row.key)).size).toBe(values.length);
      expect(state.rows.map(row => row.line.runs[0].text)).toEqual(values);
    }
  });

  it("reserves moved lines before reusing keys for changed positions", () => {
    const before = reconcileTerminalLines(lines("a", "b", "c"), empty());
    const after = reconcileTerminalLines(lines("changed", "a", "b"), before);
    expect(after.rows[1]).toBe(before.rows[0]);
    expect(after.rows[2]).toBe(before.rows[1]);
    expect(new Set(after.rows.map(row => row.key)).size).toBe(3);
  });

  it("does not match text with different ANSI styles, and never uses text as a key", () => {
    const before = reconcileTerminalLines(lines("sensitive-looking synthetic text"), empty());
    const changed = { ...before.rows[0].line, signature: "different style" };
    const after = reconcileTerminalLines([changed], before);
    expect(after.rows[0].line).toBe(changed);
    expect(after.rows[0]).not.toBe(before.rows[0]);
    expect(typeof after.rows[0].key).toBe("number");
  });

  it("retains 319 of 320 line objects through each rolling update", () => {
    let state = reconcileTerminalLines(lines(...Array.from({ length: 320 }, (_, i) => String(i))), empty());
    for (let start = 1; start <= 30; start++) {
      const before = state;
      state = reconcileTerminalLines(lines(...Array.from({ length: 320 }, (_, i) => String(start + i))), state);
      expect(state.rows.slice(0, 319)).toEqual(before.rows.slice(1));
      expect(new Set(state.rows.map(row => row.key)).size).toBe(320);
    }
  });
});
