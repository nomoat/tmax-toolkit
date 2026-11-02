import { draftNavigationAllowed } from './drafts-navigation';
import { terminalShareUrl } from './terminal-share';

export function temporaryTerminalsPath(machineId?: string | null): string {
  return machineId && machineId !== 'all'
    ? `/temporary-terminals?${new URLSearchParams({ machineId })}`
    : '/temporary-terminals';
}
export function temporaryTerminalNavigationAllowed(baseUrl: string, target: string): boolean {
  if (draftNavigationAllowed(baseUrl, target)) return true;
  // Only our signed viewer page is embedded; never allow the host API or an
  // arbitrary external page to replace the authenticated app view.
  try { return Boolean(terminalShareUrl({ viewerUrl: target })); } catch { return false; }
}
