import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CARD_ACTIONS, CARD_ACTION_LAYOUT } from './card-actions';
import { cardActionItems, type CardActionHandlers } from './card-action-state';
import type { AgentSession } from './types';

const order = ['interact', 'conversation', 'drafts', 'transcript', 'terminal', 'share', 'copyLink', 'rename', 'delete'];
const agent = { machineId: 'machine', kind: 'codex', agentSessionId: 'session', mux: 'tmux', windowId: '@1', paneId: '%1' } as AgentSession;
const handlers = () => Object.fromEntries(CARD_ACTIONS.map(action => [action.id, vi.fn()])) as unknown as CardActionHandlers;

describe('shared card actions', () => {
  it('retains the same compact action order when session identity or terminal sharing is unavailable', () => {
    const items = cardActionItems({ ...agent, agentSessionId: undefined, paneId: undefined, mux: 'rmux' }, handlers());
    expect(CARD_ACTION_LAYOUT.height).toBe(32);
    expect(items.map(action => action.id)).toEqual(order);
    expect(items.filter(action => action.disabled).map(action => action.id)).toEqual(['conversation', 'drafts', 'transcript', 'share', 'copyLink']);
  });

  it('dispatches each position to its own operation', () => {
    const operations = handlers();
    const items = cardActionItems({ ...agent, fullTextError: 'stale response' }, operations);
    for (const [index, item] of items.entries()) {
      item.onPress();
      for (const [id, handler] of Object.entries(operations)) expect(handler).toHaveBeenCalledTimes(order.indexOf(id) <= index ? 1 : 0);
    }
  });

  it('keeps its vendored contract identical to the recorded Web source', () => {
    const source = readFileSync(new URL('./card-actions.js', import.meta.url));
    const receipt = JSON.parse(readFileSync(new URL('./card-actions.source.json', import.meta.url), 'utf8'));
    expect(createHash('sha256').update(source).digest('hex')).toBe(receipt.sha256);
    expect(receipt.source).toBe('nomoat/tmax-toolkit:tmux-mobile/public/card-actions.js');
  });
});
