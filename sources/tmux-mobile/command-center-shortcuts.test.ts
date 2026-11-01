import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  resolveCommandCenterShortcut,
  type CommandCenterShortcutEvent,
} from "./command-center-shortcuts";

describe("resolveCommandCenterShortcut", () => {
  it.each([
    ["ArrowLeft", "left"],
    ["h", "left"],
    ["H", "left"],
    ["ArrowRight", "right"],
    ["l", "right"],
    ["L", "right"],
    ["ArrowUp", "up"],
    ["k", "up"],
    ["K", "up"],
    ["ArrowDown", "down"],
    ["j", "down"],
    ["J", "down"],
  ] as const)("maps %s to move %s", (key, direction) => {
    expect(resolveCommandCenterShortcut({ key })).toEqual({
      type: "move",
      direction,
    });
  });

  it.each([
    ["o", { type: "view" }],
    ["O", { type: "view" }],
    ["r", { type: "reply" }],
    ["R", { type: "reply" }],
    ["f", { type: "response" }],
    ["F", { type: "response" }],
    ["t", { type: "transcript" }],
    ["T", { type: "transcript" }],
    ["u", { type: "refresh" }],
    ["U", { type: "refresh" }],
    ["Escape", { type: "escape" }],
  ] as const)("maps %s to the expected command-center action", (key, action) => {
    expect(resolveCommandCenterShortcut({ key })).toEqual(action);
  });

  it("keeps shift-only shortcuts available", () => {
    expect(
      resolveCommandCenterShortcut({ key: "R", shiftKey: true }),
    ).toEqual({ type: "reply" });
    expect(
      resolveCommandCenterShortcut({ key: "ArrowLeft", shiftKey: true }),
    ).toEqual({ type: "move", direction: "left" });
  });

  it.each([
    ["control", { key: "r", ctrlKey: true }],
    ["command", { key: "r", metaKey: true }],
    ["option", { key: "r", altKey: true }],
    [
      "combined",
      { key: "r", ctrlKey: true, metaKey: true, altKey: true, shiftKey: true },
    ],
  ] satisfies ReadonlyArray<readonly [string, CommandCenterShortcutEvent]>)(
    "does not claim %s-modified keys",
    (_label, event) => {
      expect(resolveCommandCenterShortcut(event)).toBeNull();
    },
  );

  it.each(["o", "r", "f", "t"])(
    "ignores repeated modal-opening %s shortcuts",
    (key) => {
      expect(resolveCommandCenterShortcut({ key, repeat: true })).toBeNull();
    },
  );

  it.each(["i", "I", "s", "S"])("ignores retired read-aloud key %s from existing native bridges", (key) => {
    expect(resolveCommandCenterShortcut({ key })).toBeNull();
    expect(resolveCommandCenterShortcut({ key, repeat: true })).toBeNull();
  });

  it.each([
    { key: "k", metaKey: true },
    { key: "K", ctrlKey: true },
  ] satisfies CommandCenterShortcutEvent[])(
    "maps Web card search modifiers",
    (event) => {
      expect(resolveCommandCenterShortcut(event)).toEqual({ type: "search" });
    },
  );

  it.each([
    { key: "k", metaKey: true, shiftKey: true },
    { key: "k", ctrlKey: true, altKey: true },
    { key: "k", metaKey: true, repeat: true },
  ] satisfies CommandCenterShortcutEvent[])(
    "rejects non-Web card search modifier variants",
    (event) => {
      expect(resolveCommandCenterShortcut(event)).toBeNull();
    },
  );

  it("allows key repeat for card navigation", () => {
    expect(
      resolveCommandCenterShortcut({ key: "j", repeat: true }),
    ).toEqual({ type: "move", direction: "down" });
    expect(
      resolveCommandCenterShortcut({ key: "ArrowRight", repeat: true }),
    ).toEqual({ type: "move", direction: "right" });
  });

  it.each([
    ["already prevented", { key: "r", defaultPrevented: true }],
    ["IME composition", { key: "r", isComposing: true }],
    ["editable target", { key: "r", editableTarget: true }],
  ] satisfies ReadonlyArray<readonly [string, CommandCenterShortcutEvent]>)(
    "does not claim a shortcut from %s",
    (_label, event) => {
      expect(resolveCommandCenterShortcut(event)).toBeNull();
    },
  );

  it("preserves the installed iPad native bridge key set for OTA compatibility", () => {
    const swift = readFileSync(
      new URL(
        "../../modules/cjmux-keyboard-shortcuts/ios/CJMUXKeyboardShortcutsModule.swift",
        import.meta.url,
      ),
      "utf8",
    );
    const registeredKeys = new Set(
      [...swift.matchAll(/ShortcutKey\(input: [^,]+, key: "([^"]+)"\)/g)].map(
        (match) => match[1],
      ),
    );

    expect(registeredKeys).toEqual(
      new Set([
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "h",
        "j",
        "k",
        "l",
        "u",
        "r",
        "i",
        "s",
        "o",
        "f",
        "t",
        "Escape",
      ]),
    );
    expect(swift).toContain(".command,");
    expect(swift).toContain(".control,");
    expect(swift).toContain("[.command, .control],");
    expect(swift).not.toContain('key: "Enter"');
  });

  it.each([{ key: "" }, { key: null }, {}, { key: "x" }, { key: "Enter" }])(
    "ignores empty and unmapped input %#",
    (event) => {
      expect(resolveCommandCenterShortcut(event)).toBeNull();
    },
  );
});
