import type { AgentSession } from './types';

export function sessionDraftsPath(agent: Pick<AgentSession, 'machineId' | 'kind' | 'agentSessionId'>): string | null {
  if (!agent.machineId || !agent.agentSessionId || !['codex', 'claude', 'pi'].includes(agent.kind || '')) return null;
  return `/drafts?${new URLSearchParams({ machineId: agent.machineId, kind: agent.kind!, sessionId: agent.agentSessionId, embedded: '1' })}`;
}

export function validateDraftHandoff(baseUrl: string, handoffUrl: string): string {
  if (!handoffUrl) throw new Error('Could not open Drafts. Try again.');
  const url = new URL(handoffUrl, baseUrl);
  if (url.origin !== new URL(baseUrl).origin || url.pathname !== '/auth/browser-handoff') {
    throw new Error('Controller returned an invalid Drafts sign-in link.');
  }
  return url.toString();
}

export function draftNavigationAllowed(baseUrl: string, target: string): boolean {
  if (target === 'about:blank') return true;
  try { return new URL(target).origin === new URL(baseUrl).origin; }
  catch { return false; }
}
