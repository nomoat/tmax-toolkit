import type { UserSnippetItem } from "@/tmux-mobile/types";

const GOAL_COMMAND = "/goal";

export const FALLBACK_SNIPPETS: UserSnippetItem[] = [
  { text: "/clear" },
  { text: "/model" },
  { text: "/goal " },
  { text: "/rename " },
  { text: "/btw " },
  { text: "/grill-me" },
];

export function composerSnippetLabel(text: string): string {
  return text.trim().toLowerCase() === GOAL_COMMAND ? GOAL_COMMAND : text;
}

export function prioritizeGoalSnippet(
  items: UserSnippetItem[],
): UserSnippetItem[] {
  const goalIndex = items.findIndex(
    (item) => item.text.trim().toLowerCase() === GOAL_COMMAND,
  );
  if (goalIndex < 0) return items;
  const goal = items[goalIndex];
  const withoutGoal = items.filter(
    (item) => item.text.trim().toLowerCase() !== GOAL_COMMAND,
  );
  const modelIndex = withoutGoal.findIndex(
    (item) => item.text.trim().toLowerCase() === "/model",
  );
  const insertAt = modelIndex >= 0 ? modelIndex + 1 : 0;
  return [
    ...withoutGoal.slice(0, insertAt),
    goal,
    ...withoutGoal.slice(insertAt),
  ];
}
