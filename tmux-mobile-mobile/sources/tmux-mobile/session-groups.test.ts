import { describe, expect, it } from "vitest";
import { agentStarKey, type AgentSession } from "@/tmux-mobile/types";
import {
  groupAgentSessions,
  normalizeCardSort,
  latestActivityTime,
  compareRecentActivity,
  groupIndexForAgent,
  nextExpandedAgentKey,
} from "@/tmux-mobile/session-groups";

function agent(input: Partial<AgentSession>): AgentSession {
  return {
    machineId: "machine-a",
    machineHostname: "Alpha",
    mux: "tmux",
    sessionId: "$1",
    sessionName: "work",
    windowId: "@1",
    windowIndex: 0,
    windowName: "shell",
    ...input,
  };
}

describe("groupAgentSessions", () => {
  it("puts starred windows first and groups the rest like tmux-jump", () => {
    const starred = agent({
      sessionId: "$9",
      sessionName: "z-last",
      windowId: "@9",
      windowIndex: 9,
      lastActivityAt: "2026-08-21T18:00:00Z",
    });
    const source = [
      agent({ sessionId: "$2", sessionName: "beta", windowId: "@4", windowIndex: 4 }),
      starred,
      agent({ sessionId: "$1", sessionName: "alpha", windowId: "@3", windowIndex: 3 }),
      agent({ sessionId: "$1", sessionName: "alpha", windowId: "@0", windowIndex: 0 }),
    ];

    const result = groupAgentSessions(source, new Set([agentStarKey(starred)]), ["machine-a"]);

    expect(result.groups.map((group) => group.title)).toEqual(["Starred", "alpha", "beta"]);
    expect(result.groups[1]?.agents.map((item) => item.windowIndex)).toEqual([0, 3]);
    expect(result.agents.map((item) => item.windowId)).toEqual(["@9", "@0", "@3", "@4"]);
    expect(result.sessionCount).toBe(3);
  });

  it("keeps same-named sessions separate across machines and muxes", () => {
    const source = [
      agent({ machineId: "machine-b", machineHostname: "Beta", windowId: "@2" }),
      agent({ machineId: "machine-a", mux: "rmux", windowId: "@3" }),
      agent({ machineId: "machine-a", mux: "tmux", windowId: "@1" }),
    ];

    const result = groupAgentSessions(source, new Set(), ["machine-a", "machine-b"]);

    expect(result.groups.map((group) => [group.title, group.subtitle])).toEqual([
      ["work", "Alpha · rmux"],
      ["work", "Alpha · tmux"],
      ["work", "Beta · tmux"],
    ]);
  });

  it("sorts across sessions by recent activity while keeping stars first", () => {
    const source = [
      agent({ windowId: "@new", sessionName: "alpha", windowIndex: 0, lastActivityAt: "2026-09-14T12:00:00Z" }),
      agent({ windowId: "@old", sessionName: "alpha", windowIndex: 1, lastActivityAt: "2026-09-12T12:00:00Z" }),
      agent({ windowId: "@middle", sessionId: "$2", sessionName: "beta", lastActivityAt: "invalid", lastAssistantAt: "2026-09-13T12:00:00Z" }),
      agent({ windowId: "@star", windowIndex: 9, sessionId: "$2", sessionName: "beta" }),
      agent({ windowId: "@missing", sessionId: "$3", sessionName: "gamma" }),
    ];
    const stars = new Set([agentStarKey(source[3])]);
    expect(groupAgentSessions(source, stars).agents.map(a => a.windowId)).toEqual(["@star", "@new", "@old", "@middle", "@missing"]);
    const recent = groupAgentSessions(source, stars, [], "recent");
    expect(recent.agents.map(a => a.windowId)).toEqual(["@star", "@new", "@middle", "@old", "@missing"]);
    expect(recent.sessionCount).toBe(3);
    expect(normalizeCardSort("recent")).toBe("recent");
    expect(normalizeCardSort(null)).toBe("current");
    expect(normalizeCardSort("bad")).toBe("current");
    expect(source[0].windowId).toBe("@new");
  });

  it("returns the containing group for keyboard navigation", () => {
    const first = agent({ sessionId: "$1", sessionName: "alpha", windowId: "@1" });
    const second = agent({ sessionId: "$2", sessionName: "beta", windowId: "@2" });
    const { groups } = groupAgentSessions([second, first], new Set());

    expect(groupIndexForAgent(groups, second)).toBe(1);
    expect(groupIndexForAgent(groups, first)).toBe(0);
  });

  it("sorts picker entries only by latest activity without changing starred feed order", () => {
    const source = [
      agent({ windowId: "@star", lastActivityAt: "2026-09-10T12:00:00Z" }),
      agent({ windowId: "@missing", windowIndex: 1, lastActivityAt: "invalid" }),
      agent({ windowId: "@assistant", windowIndex: 2, lastActivityAt: "invalid", lastAssistantAt: "2026-09-13T12:00:00Z" }),
      agent({ windowId: "@user", windowIndex: 3, lastActivityAt: "2026-09-12T12:00:00Z", lastUserAt: "2026-09-14T12:00:00Z" }),
    ];
    for (const sortBy of ["current", "recent"] as const) {
      const feed = groupAgentSessions(source, new Set([agentStarKey(source[0])]), [], sortBy).agents;
      expect([...feed].sort(compareRecentActivity).map(a => a.windowId)).toEqual(["@user", "@assistant", "@star", "@missing"]);
      expect(feed[0].windowId).toBe("@star");
    }
    expect(latestActivityTime(source[3])).toBe(Date.parse("2026-09-14T12:00:00Z"));
    expect(latestActivityTime(source[1])).toBe(0);
    expect(compareRecentActivity(source[0], { ...source[0], windowIndex: 99 })).toBe(0);
  });
});

describe("nextExpandedAgentKey", () => {
  it("opens one card, replaces it with another, and closes it on a second tap", () => {
    expect(nextExpandedAgentKey("", "card-a")).toBe("card-a");
    expect(nextExpandedAgentKey("card-a", "card-b")).toBe("card-b");
    expect(nextExpandedAgentKey("card-b", "card-b")).toBe("");
  });
});
