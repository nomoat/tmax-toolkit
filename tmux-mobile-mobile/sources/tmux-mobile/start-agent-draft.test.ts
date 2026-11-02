import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { agentMachineKey, machineKey } from "./types";

// Execute the actual form initializer, without loading Expo's native modules.
const source = fs.readFileSync(path.resolve("sources/app/(app)/index.tsx"), "utf8");
const form = source.slice(source.indexOf("function StartAgentModal("));
const initializer = form.match(/React\.useEffect\(\(\) => \{[\s\S]*?\}, \[machines, selectedAgent, visible\]\);/)![0];

function harness() {
  const draft: Record<string, unknown> = {};
  const context = {
    React: { useEffect: (effect: () => void) => effect() },
    initializedForOpen: { current: false },
    activeVoiceFieldRef: { current: null as string | null },
    visible: true,
    machines: [{ machineId: "machine-a", homeDir: "/home/a", mux: "tmux" }],
    selectedAgent: null,
    agentMachineKey,
    machineKey,
    ...Object.fromEntries(
      ["MachineId", "Kind", "Cwd", "Mux", "SessionName", "ActiveVoiceField", "VoiceStatus"]
        .map(key => [`set${key}`, (value: unknown) => { draft[key] = value; }]),
    ),
  };
  const render = () => vm.runInNewContext(initializer, context);
  return { draft, context, render };
}

describe("Start agent draft during background refresh", () => {
  it("preserves edited fields and active dictation across 100 inventory refreshes", () => {
    const { draft, context, render } = harness();
    render();
    Object.assign(draft, {
      MachineId: "chosen-machine", Kind: "claude", Cwd: "/my/project",
      Mux: "rmux", SessionName: "unfinished session", ActiveVoiceField: "session",
      VoiceStatus: "Listening",
    });
    context.activeVoiceFieldRef.current = "session";
    const edited = { ...draft };
    for (let i = 0; i < 100; i++) {
      context.machines = i % 2 ? [] : [{ machineId: "machine-b", homeDir: `/changed/${i}`, mux: "tmux" }];
      render();
      expect(draft).toEqual(edited);
      expect(context.activeVoiceFieldRef.current).toBe("session");
    }
  });

  it("uses the latest defaults when closed and opened again", () => {
    const { draft, context, render } = harness();
    render();
    draft.SessionName = "old draft";
    context.visible = false;
    render();
    context.machines = [{ machineId: "machine-b", homeDir: "/home/b", mux: "rmux" }];
    render();
    expect(draft.SessionName).toBe("old draft");
    context.visible = true;
    render();
    expect(draft).toMatchObject({ MachineId: "machine-b", Cwd: "/home/b", Mux: "rmux", SessionName: "" });
  });
});
