import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

// Execute the actual refresh function with an expired reconnect grace period.
const source = await readFile(new URL("../public/command-center.js", import.meta.url), "utf8");
const code = source.slice(source.indexOf("async function loadMachineAgents("), source.indexOf("async function loadAgentsByMachine("));
let resolve, reject;
const state = { loadGeneration: 1, agents: [{ machineId: "m", lastAssistantText: "Existing reply" }], machineLoads: new Map() };
const context = vm.createContext({ state, viewReads: { active: true },
  machineKey: m => m.id, agentMachineKey: a => a.machineId,
  api: () => new Promise((yes, no) => { resolve = yes; reject = no; }),
  completeResponses: async a => a, replaceMachine() {}, updateMachineAgentCounts() {},
  replaceAgentsForMachine: (key, agents) => { state.agents = agents; },
  shouldPreserveEmptyInventory: m => ["pending", "stale", "failed"].includes(m.inventoryStatus),
  clearCommandCenterReconnect() {}, loadStatusForMachine: () => "loaded",
  holdCommandCenterSnapshot: () => false,
});
vm.runInContext(code, context);
const run = () => context.loadMachineAgents({ id: "m" }, 1, { render: false });
let pending = run();
assert.equal(state.agents[0].lastAssistantText, "Existing reply", "in-flight refresh keeps content");
reject(new Error("timeout")); await pending;
assert.equal(state.agents[0].lastAssistantText, "Existing reply", "failed refresh keeps content beyond reconnect grace");
assert.equal(state.machineLoads.get("m").status, "error");
pending = run(); resolve({ machines: [{ id: "m", inventoryStatus: "failed" }], agents: [] }); await pending;
assert.equal(state.agents[0].lastAssistantText, "Existing reply");
pending = run(); resolve({ machines: [{ id: "m", inventoryStatus: "fresh" }], agents: [] }); await pending;
assert.equal(state.agents.length, 0, "confirmed removal clears the card");
state.agents = [{ machineId: "m", lastAssistantText: "Private reply" }];
pending = run(); reject(Object.assign(new Error("Forbidden"), { status: 403 })); await pending;
assert.equal(state.agents.length, 0, "revoked access clears cached content");
console.log("Command Center refresh: in-flight, timeout, failed inventory, confirmed removal and revoked access passed");
