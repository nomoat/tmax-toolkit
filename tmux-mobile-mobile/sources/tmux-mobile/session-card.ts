import type { AgentSession } from "@/tmux-mobile/types";
import { agentMachineKey } from "@/tmux-mobile/types";

export type SessionCardSummary = {
  windowName: string;
  sessionName: string;
  agentSessionTitle: string;
  directory: string;
  machineName: string;
  lastActivityAt: string | null;
};

export function sessionModelLabel(agent: AgentSession): string {
  return [agent.agentMode?.model, agent.agentMode?.effort]
    .map(cleanLabel)
    .filter(Boolean)
    .join(" · ");
}

export function agentSessionDisplayLabel(agent: AgentSession): string {
  const kind = cleanLabel(agent.kind).toLocaleLowerCase();
  const kindLabel =
    kind === "codex"
      ? "Codex"
      : kind === "claude"
        ? "Claude"
        : kind
          ? `${kind.slice(0, 1).toLocaleUpperCase()}${kind.slice(1)}`
          : "";
  const title = cleanLabel(agent.agentSessionTitle);
  if (kindLabel && title) return `${kindLabel} · ${title}`;
  return title || kindLabel;
}

function cleanLabel(value: string | null | undefined): string {
  return String(value || "").trim();
}

function latestTimestamp(
  values: Array<string | null | undefined>,
): string | null {
  let latestValue: string | null = null;
  let latestTime = 0;
  values.forEach((value) => {
    const cleaned = cleanLabel(value);
    const time = Date.parse(cleaned);
    if (!cleaned || !Number.isFinite(time) || time <= latestTime) return;
    latestValue = cleaned;
    latestTime = time;
  });
  return latestValue;
}

export function sessionCardSummary(agent: AgentSession): SessionCardSummary {
  const sessionName = cleanLabel(agent.sessionName) || cleanLabel(agent.sessionId);
  return {
    windowName: cleanLabel(agent.windowName) || sessionName || "(unnamed)",
    sessionName,
    agentSessionTitle: cleanLabel(agent.agentSessionTitle),
    directory: cleanLabel(agent.cwd),
    machineName:
      cleanLabel(agent.machineHostname) || cleanLabel(agentMachineKey(agent)),
    lastActivityAt: latestTimestamp([
      agent.lastActivityAt,
      agent.lastAssistantAt,
      agent.lastUserAt,
    ]),
  };
}
