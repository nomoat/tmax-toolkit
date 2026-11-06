import * as React from "react";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "android" }));
vi.mock("react-native", () => ({
  Platform: platform,
  StyleSheet: { flatten: (style: unknown) => style },
  Text: ({ children, onLongPress }: { children: React.ReactNode; onLongPress?: () => void }) =>
    React.createElement("span", { "data-paragraph": onLongPress ? "true" : undefined }, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
}));

import { parseAnsiLines, renderAnsiText } from "./ansi";
import { TerminalOutput } from "./terminal-output";
const { renderToStaticMarkup } = createRequire(import.meta.url)("react-dom/server") as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

const textOf = (nodes: React.ReactNode[]): string => nodes.map(node => typeof node === "string"
  ? node : (node as React.ReactElement<{ children: string }>).props.children).join("");
const linesOf = (text: string) => parseAnsiLines(text).map(line => line.runs.map(run => run.text).join(""));

describe("Android terminal paragraphs", () => {
  it("carries color and formatting across line boundaries and applies resets", () => {
    const lines = parseAnsiLines("\x1b[31;1mfirst\nsecond\x1b[0m plain\nthird");
    expect(lines.map(line => line.runs.map(run => run.text).join(""))).toEqual(["first", "second plain", "third"]);
    expect(lines[0].runs[0].style).toEqual({ color: "#b22222", fontWeight: "700" });
    expect(lines[1].runs[0].style).toEqual(lines[0].runs[0].style);
    expect(lines[1].runs[1].style).toBeNull();
    expect(lines[2].runs[0].style).toBeNull();
  });

  it("preserves empty lines, trailing newline, Unicode and unsupported-control cleanup", () => {
    const input = "\x1b]0;synthetic title\x07中文😀\n\n\x1b[2Ktail\r";
    expect(linesOf(input)).toEqual(["中文😀", "", "tail", ""]);
    expect(linesOf(input).join("\n")).toBe(textOf(renderAnsiText(input)));
    expect(linesOf("")).toEqual([""]);
  });

  it("retains background, RGB, inverse and underline styles across lines", () => {
    const lines = parseAnsiLines("\x1b[38;2;1;2;3;44;4mA\nB\x1b[7mC");
    expect(lines[0].runs[0].style).toEqual({ color: "rgb(1,2,3)", backgroundColor: "#1f5b8f", textDecorationLine: "underline" });
    expect(lines[1].runs[0].style).toEqual(lines[0].runs[0].style);
    expect(lines[1].runs[1].style).toEqual({ color: "#1f5b8f", backgroundColor: "rgb(1,2,3)", textDecorationLine: "underline" });
  });

  it("coalesces equivalent runs and identifies unchanged lines when only the tail changes", () => {
    const before = parseAnsiLines("\x1b[31mA\x1b[31mB\nC");
    const after = parseAnsiLines("\x1b[31mA\x1b[31mB\nD");
    expect(before[0].runs).toHaveLength(1);
    expect(before[0].runs[0].text).toBe("AB");
    expect(before[0].signature).toBe(after[0].signature);
    expect(before[1].signature).not.toBe(after[1].signature);
  });

  it("gives dense Android output independent native paragraphs while preserving its text", () => {
    platform.OS = "android";
    const line = Array.from({ length: 16 }, (_, i) => `\x1b[${31 + i % 6}mabcde`).join("");
    const input = Array.from({ length: 320 }, () => line).join("\n");
    const parsed = parseAnsiLines(input);
    expect(parsed).toHaveLength(320);
    expect(parsed.every(row => row.runs.length === 16)).toBe(true);
    expect(parsed.map(row => row.runs.map(run => run.text).join("")).join("\n")).toBe(textOf(renderAnsiText(input)));
    const html = renderToStaticMarkup(React.createElement(TerminalOutput, { text: input, style: {}, onLongPress() {} }));
    expect(html.startsWith("<div>")).toBe(true);
    expect(html.match(/data-paragraph="true"/g)).toHaveLength(320);
  });

  it("keeps iOS on its existing single-Text rendering path", () => {
    platform.OS = "ios";
    const html = renderToStaticMarkup(React.createElement(TerminalOutput, { text: "\x1b[31mfirst\nsecond", style: {}, onLongPress() {} }));
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("<div>");
    expect(html.match(/data-paragraph="true"/g)).toHaveLength(1);
    expect(html).toContain("first\nsecond");
    platform.OS = "android";
  });
});
