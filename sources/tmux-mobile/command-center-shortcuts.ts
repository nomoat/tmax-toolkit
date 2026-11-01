export type CommandCenterShortcutDirection = "left" | "right" | "up" | "down";

export type CommandCenterShortcut =
  | { type: "move"; direction: CommandCenterShortcutDirection }
  | { type: "view" }
  | { type: "reply" }
  | { type: "response" }
  | { type: "transcript" }
  | { type: "refresh" }
  | { type: "search" }
  | { type: "escape" };

export type CommandCenterShortcutEvent = {
  key?: string | null;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
  editableTarget?: boolean;
};

const DIRECTION_BY_KEY: Readonly<
  Record<string, CommandCenterShortcutDirection>
> = {
  ArrowLeft: "left",
  h: "left",
  ArrowRight: "right",
  l: "right",
  ArrowUp: "up",
  k: "up",
  ArrowDown: "down",
  j: "down",
};

function opensModal(shortcut: CommandCenterShortcut): boolean {
  return (
    shortcut.type === "view" ||
    shortcut.type === "reply" ||
    shortcut.type === "response" ||
    shortcut.type === "transcript" ||
    shortcut.type === "search"
  );
}

export function resolveCommandCenterShortcut(
  event: CommandCenterShortcutEvent,
): CommandCenterShortcut | null {
  const key = String(event.key || "");
  const lowered = key.toLowerCase();
  if (
    !key ||
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey
  ) {
    return null;
  }

  if (
    lowered === "k" &&
    !event.shiftKey &&
    Boolean(event.ctrlKey || event.metaKey)
  ) {
    return event.repeat ? null : { type: "search" };
  }
  if (event.editableTarget || event.ctrlKey || event.metaKey) return null;

  let shortcut: CommandCenterShortcut | null = null;
  if (key === "Escape") {
    shortcut = { type: "escape" };
  } else {
    const direction = DIRECTION_BY_KEY[key] || DIRECTION_BY_KEY[key.toLowerCase()];
    if (direction) {
      shortcut = { type: "move", direction };
    } else {
      if (lowered === "o") {
        shortcut = { type: "view" };
      } else if (lowered === "r") {
        shortcut = { type: "reply" };
      } else if (lowered === "f") {
        shortcut = { type: "response" };
      } else if (lowered === "t") {
        shortcut = { type: "transcript" };
      } else if (lowered === "u") {
        shortcut = { type: "refresh" };
      }
    }
  }

  if (shortcut && event.repeat && opensModal(shortcut)) return null;
  return shortcut;
}
