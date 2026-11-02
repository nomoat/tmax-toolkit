import { describe, expect, it } from "vitest";
import {
  agentSessionDisplayLabel,
  sessionCardSummary,
  sessionModelLabel,
} from "@/tmux-mobile/session-card";

describe("sessionCardSummary", () => {
  it("returns the fields needed to describe a session card", () => {
    expect(
      sessionCardSummary({
        machineId: "machine-id",
        machineHostname: "studio",
        windowName: "Implement card view",
        sessionName: "codex-main",
        agentSessionTitle: "Simplify session cards",
        cwd: "/Users/me/src/tmux-mobile",
        lastActivityAt: "2026-07-25T18:00:00.000Z",
      }),
    ).toEqual({
      windowName: "Implement card view",
      sessionName: "codex-main",
      agentSessionTitle: "Simplify session cards",
      directory: "/Users/me/src/tmux-mobile",
      machineName: "studio",
      lastActivityAt: "2026-07-25T18:00:00.000Z",
    });
  });

  it("uses stable fallbacks and the latest valid activity timestamp", () => {
    expect(
      sessionCardSummary({
        machineId: "fallback-machine",
        sessionId: "session-id",
        lastActivityAt: null,
        lastUserAt: "2026-07-25T17:00:00.000Z",
        lastAssistantAt: "2026-07-25T17:03:00.000Z",
      }),
    ).toEqual({
      windowName: "session-id",
      sessionName: "session-id",
      agentSessionTitle: "",
      directory: "",
      machineName: "fallback-machine",
      lastActivityAt: "2026-07-25T17:03:00.000Z",
    });
  });
});

describe("agentSessionDisplayLabel", () => {
  it("combines the Agent kind and native session name on one line", () => {
    expect(
      agentSessionDisplayLabel({
        kind: "codex",
        agentSessionTitle: "Simplify session cards",
      }),
    ).toBe("Codex · Simplify session cards");
  });

  it("keeps the Agent kind when older connectors have no native name", () => {
    expect(agentSessionDisplayLabel({ kind: "claude" })).toBe("Claude");
  });
});

describe("sessionModelLabel", () => {
  it("joins the live model and reasoning effort compactly", () => {
    expect(
      sessionModelLabel({
        agentMode: { model: " gpt-5.6-terra ", effort: " high " },
      }),
    ).toBe("gpt-5.6-terra · high");
  });

  it("omits unavailable metadata without leaving separators", () => {
    expect(sessionModelLabel({ agentMode: { model: "Sonnet 4.6" } })).toBe(
      "Sonnet 4.6",
    );
    expect(sessionModelLabel({})).toBe("");
  });
});
