import { describe, expect, it } from "vitest";
import {
  composerSnippetLabel,
  FALLBACK_SNIPPETS,
  prioritizeGoalSnippet,
} from "@/tmux-mobile/composer-snippets";

describe("composerSnippetLabel", () => {
  it("keeps the established default order and includes the goal slash command", () => {
    expect(FALLBACK_SNIPPETS.map((item) => item.text)).toEqual([
      "/clear",
      "/model",
      "/goal ",
      "/rename ",
      "/btw ",
      "/grill-me",
    ]);
    expect(FALLBACK_SNIPPETS.every((item) => item.text.startsWith("/"))).toBe(true);
  });

  it("shows the goal slash command with its slash without changing its inserted text", () => {
    const goal = FALLBACK_SNIPPETS.find((item) => item.text.trim() === "/goal");

    expect(goal?.text).toBe("/goal ");
    expect(composerSnippetLabel(goal?.text || "")).toBe("/goal");
  });

  it("recognizes the goal command without relying on whitespace or case", () => {
    expect(composerSnippetLabel("/goal")).toBe("/goal");
    expect(composerSnippetLabel("/GOAL ")).toBe("/goal");
  });

  it("keeps all other snippet labels unchanged", () => {
    expect(composerSnippetLabel("/clear")).toBe("/clear");
    expect(composerSnippetLabel("/model")).toBe("/model");
    expect(composerSnippetLabel("/grill-me")).toBe("/grill-me");
    expect(composerSnippetLabel("continue")).toBe("continue");
  });

  it("promotes goal immediately after model without overriding customization", () => {
    const withoutGoal = [
      { text: "yes" },
      { text: "/model" },
      { text: "codex" },
    ];
    expect(prioritizeGoalSnippet(withoutGoal)).toBe(withoutGoal);
    expect(
      prioritizeGoalSnippet([
        { text: "yes" },
        { text: "/model" },
        { text: "codex" },
        { text: "/GOAL " },
      ]).map((item) => item.text),
    ).toEqual(["yes", "/model", "/GOAL ", "codex"]);
  });
});
