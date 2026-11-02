export type CardActionId = 'interact' | 'conversation' | 'drafts' | 'transcript' | 'terminal' | 'share' | 'copyLink' | 'rename' | 'delete';
export type CardIconId = CardActionId;
export type CardAction = { id: CardActionId; label: string; hint: string };
export const CARD_ACTION_LAYOUT: { minWidth: number; height: number; gap: number };
export const CARD_ACTIONS: readonly CardAction[];
export const CARD_ACTION_ICONS: Record<CardIconId, readonly [string, Record<string, string | number>][] >;
