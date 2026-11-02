import {
  agentCardKey,
  agentMachineKey,
  isAgentStarred,
  type AgentSession,
} from "./types";

export const CARD_SORT_KEY = "tmux-mobile-card-sort";
export type CardSort = "current" | "recent";
export function normalizeCardSort(value: unknown): CardSort {
  return value === "recent" ? "recent" : "current";
}

export type AgentSessionGroup = {
  key: string;
  title: string;
  subtitle: string;
  kind: "starred" | "session" | "recent";
  agents: AgentSession[];
};

export type GroupedAgentSessions = {
  groups: AgentSessionGroup[];
  agents: AgentSession[];
  sessionCount: number;
};

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function windowIndex(agent: AgentSession): number {
  const value = Number(agent.windowIndex ?? agent.index);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function compareWindows(left: AgentSession, right: AgentSession): number {
  const indexOrder = windowIndex(left) - windowIndex(right);
  if (indexOrder !== 0) return indexOrder;
  const nameOrder = compareText(String(left.windowName || ""), String(right.windowName || ""));
  if (nameOrder !== 0) return nameOrder;
  return compareText(agentCardKey(left), agentCardKey(right));
}

export function latestActivityTime(agent: AgentSession): number {
  const values = [agent.lastActivityAt, agent.lastAssistantAt, agent.lastUserAt];
  return values.reduce((latest, value) => {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
}

export function compareRecentActivity(left: AgentSession, right: AgentSession): number {
  return latestActivityTime(right) - latestActivityTime(left);
}

function compareStarred(left: AgentSession, right: AgentSession): number {
  const activityOrder = compareRecentActivity(left, right);
  return activityOrder || compareWindows(left, right);
}

function clean(value: unknown): string {
  return String(value || "").trim();
}

function sessionIdentity(agent: AgentSession): string {
  return clean(agent.sessionId) || clean(agent.sessionName) || "(unnamed session)";
}

function sessionTitle(agent: AgentSession): string {
  return clean(agent.sessionName) || clean(agent.sessionId) || "Unnamed session";
}

function machineTitle(agent: AgentSession): string {
  return clean(agent.machineHostname) || agentMachineKey(agent);
}

function sessionGroupKey(agent: AgentSession): string {
  return [agentMachineKey(agent), clean(agent.mux) || "tmux", sessionIdentity(agent)].join("::");
}

/**
 * Mirrors tmux-jump's stable hierarchy: sessions alphabetically, then numeric
 * tmux window index. Machine order is supplied by the caller because the
 * desktop picker only has one machine while Command Center can span several.
 */
export function groupAgentSessions(
  source: AgentSession[],
  stars: Set<string>,
  machineOrder: string[] = [],
  sortBy: CardSort = "current",
): GroupedAgentSessions {
  const machineRank = new Map(machineOrder.map((key, index) => [key, index]));
  const starred: AgentSession[] = [];
  const sessionKeys = new Set<string>();
  const sessionMap = new Map<string, AgentSessionGroup & { machineId: string; mux: string }>();

  source.forEach((agent) => {
    sessionKeys.add(sessionGroupKey(agent));
    if (isAgentStarred(agent, stars)) {
      starred.push(agent);
      return;
    }

    const key = sessionGroupKey(agent);
    const mux = clean(agent.mux) || "tmux";
    const group = sessionMap.get(key) || {
      key,
      title: sessionTitle(agent),
      subtitle: `${machineTitle(agent)} · ${mux}`,
      kind: "session" as const,
      agents: [],
      machineId: agentMachineKey(agent),
      mux,
    };
    group.agents.push(agent);
    sessionMap.set(key, group);
  });

  const sessionGroups = [...sessionMap.values()];
  sessionGroups.forEach((group) => group.agents.sort(compareWindows));
  sessionGroups.sort((left, right) => {
    const leftRank = machineRank.get(left.machineId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = machineRank.get(right.machineId) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const machineOrder = compareText(left.machineId, right.machineId);
    if (machineOrder !== 0) return machineOrder;
    const muxOrder = compareText(left.mux, right.mux);
    if (muxOrder !== 0) return muxOrder;
    return compareText(left.title, right.title) || compareText(left.key, right.key);
  });

  const groups: AgentSessionGroup[] = [];
  if (starred.length > 0) {
    starred.sort(compareStarred);
    groups.push({
      key: "starred",
      title: "Starred",
      subtitle: "Priority windows across sessions",
      kind: "starred",
      agents: starred,
    });
  }
  if (sortBy === "recent") {
    const recent = sessionGroups.flatMap((group) => group.agents).sort(compareStarred);
    if (recent.length) groups.push({
      key: "recent", title: "Recent activity", subtitle: "Newest first · Starred cards stay on top",
      kind: "recent", agents: recent,
    });
  } else {
    groups.push(...sessionGroups);
  }

  return {
    groups,
    agents: groups.flatMap((group) => group.agents),
    sessionCount: sessionKeys.size,
  };
}

export function groupIndexForAgent(groups: AgentSessionGroup[], agent: AgentSession): number {
  const key = agentCardKey(agent);
  return Math.max(
    0,
    groups.findIndex((group) => group.agents.some((candidate) => agentCardKey(candidate) === key)),
  );
}

/** A single key is the complete accordion state, so two cards cannot be open. */
export function nextExpandedAgentKey(currentKey: string, pressedKey: string): string {
  const nextKey = String(pressedKey || "");
  if (!nextKey || currentKey === nextKey) return "";
  return nextKey;
}
