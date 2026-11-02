import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../app/(app)/index.tsx", import.meta.url),
  "utf8",
);
const cardSource = appSource.slice(
  appSource.indexOf("function AgentCard("),
  appSource.indexOf("function CardSectionHeader("),
);

function expectInOrder(source: string, values: string[]) {
  let cursor = -1;
  for (const value of values) {
    const next = source.indexOf(value, cursor + 1);
    expect(next, `${value} should appear after the previous action`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe("Command Center card action parity", () => {
  it("binds every shared footer action to the matching operation", () => {
    expect(cardSource).toContain("<CardActionBar");
    for (const binding of [
      "interact: onSend", "conversation: onConversation", "drafts: onDrafts",
      "transcript: onTranscript", "terminal: onView",
      "share: onShareTerminal", "copyLink: onCopyConversation",
      "rename: onRename", "delete: onDelete",
    ]) expect(cardSource).toContain(binding);
  });

  it("keeps content actions beside their matching prompt or response heading", () => {
    expectInOrder(cardSource, [
      'label="Last prompt"',
      'label="Copy prompt"',
      'label="Last response"',
      'label="Open response"',
      'label="Pin response"',
      'label="Copy response"',
    ]);
  });

  it("keeps SSH contextual to the terminal instead of changing card muscle memory", () => {
    expect(cardSource).not.toContain("Open SSH terminal");
    expect(appSource).toMatch(
      /function WindowViewModal\([\s\S]*?label="Open SSH terminal"/,
    );
  });
});
