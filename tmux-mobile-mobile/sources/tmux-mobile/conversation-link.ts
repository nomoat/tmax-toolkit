import type { AgentSession } from './types';
export function conversationPath(agent: AgentSession): string | null {
  if (!agent.machineId || !agent.agentSessionId || !['codex', 'claude', 'pi'].includes(agent.kind || '')) return null;
  return `/conversation?${new URLSearchParams({ machineId: agent.machineId, kind: agent.kind!, sessionId: agent.agentSessionId })}`;
}
