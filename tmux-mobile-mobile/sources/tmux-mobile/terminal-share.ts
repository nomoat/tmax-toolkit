import { agentMachineKey, type AgentSession } from './types';

export const SHARE_DURATIONS = [
  { seconds: 600, label: '10 minutes' },
  { seconds: 86400, label: '24 hours' },
  { seconds: 432000, label: '5 days' },
  { seconds: 604800, label: '7 days' },
] as const;
export type TerminalShareAction = 'status' | 'start' | 'stop';
export type TerminalShareState = {
  viewerUrl?: string;
  expiresAt?: number;
  ttlSeconds?: number;
  allowControl?: boolean;
};
export function canShareTerminal(agent: AgentSession | null | undefined): boolean {
  return Boolean(agent && (agent.mux || 'tmux') === 'tmux' && (agent.paneId || agent.windowId));
}
export function terminalShareRequest(agent: AgentSession, action: TerminalShareAction, ttlSeconds = 86400, allowControl = true) {
  if (!canShareTerminal(agent)) throw new Error('Terminal sharing requires a tmux pane or window.');
  if (!SHARE_DURATIONS.some(item => item.seconds === ttlSeconds)) throw new Error('Choose 10 minutes, 24 hours, 5 days or 7 days.');
  return {
    method: 'POST', machineId: agentMachineKey(agent), headers: { 'x-mux': 'tmux' },
    body: { action, ...(agent.paneId ? { paneId: agent.paneId } : { windowId: agent.windowId }), ttlSeconds, allowControl },
  };
}
export function terminalShareUrl(state: TerminalShareState): string | null {
  if (!state.viewerUrl) return null;
  const url = new URL(state.viewerUrl);
  if (url.origin !== 'https://share.xyznot.com' || !/^\/s\/[0-9a-f-]{36}$/.test(url.pathname) || url.hash.length < 2 || url.username || url.password) {
    throw new Error('The server returned an invalid terminal share link.');
  }
  return url.toString();
}
