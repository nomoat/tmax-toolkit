import { describe, expect, it, vi } from "vitest";
import { createFullResponseLoader, needsFullResponse } from "./full-response";
import { mermaidHtml } from "./mermaid-html";
import type { AgentSession } from "./types";

const long = "完整回复😀".repeat(1500) + "\n```mermaid\nflowchart TD\nA-->B\n```\n完整结尾";
const agent: AgentSession = { paneId: "%72", machineId: "reef-machine", mux: "rmux", agentSessionId: "reef", lastAssistantText: "中".repeat(1364) + "ab" };
const result = { sessionId: "reef", turns: [{ role: "assistant", text: long, t: "2026-09-10" }] };

describe("complete iOS card responses", () => {
  it("recognizes UTF-8 preview boundaries and skips short messages", () => {
    expect(needsFullResponse(agent)).toBe(true);
    expect(needsFullResponse({ lastAssistantText: "😀".repeat(1023) })).toBe(false);
    expect(needsFullResponse({ lastAssistantText: "ok", lastAssistantTruncated: true })).toBe(true);
  });
  it("keeps all Unicode, Mermaid and final text with machine/mux scoping", async () => {
    const read = vi.fn(async () => ({ result }));
    const [full, short] = await createFullResponseLoader(read)([agent, { lastAssistantText: "short" }]);
    expect(full.lastAssistantText).toBe(long);
    expect(full.lastAssistantAt).toBe("2026-09-10");
    expect(short.lastAssistantText).toBe("short");
    expect(read).toHaveBeenCalledExactlyOnceWith("reef-machine", "%72", "rmux", undefined);
  });
  it("makes failures visible and rejects reused panes", async () => {
    const [mismatch] = await createFullResponseLoader(async () => ({ result: { ...result, sessionId: "other" } }))([agent]);
    expect(mismatch.fullTextError).toMatch(/Session changed/);
    const [failed] = await createFullResponseLoader(async () => { throw new Error("offline"); })([agent]);
    expect(failed.fullTextError).toBe("offline");
  });
  it("cancels 100 refreshes during slow requests without expanding concurrency", async () => {
    let running = 0, max = 0, calls = 0;
    const releases: Array<() => void> = [];
    const load = createFullResponseLoader(async () => {
      calls++; running++; max = Math.max(max, running);
      await new Promise<void>(resolve => releases.push(resolve));
      running--;
      return { result };
    });
    const pending = [];
    for (let i = 0; i < 100; i++) {
      const controller = new AbortController();
      pending.push(load([agent], controller.signal).catch(error => error));
      controller.abort();
    }
    expect(max).toBe(4);
    releases.forEach(release => release());
    await Promise.all(pending);
    expect(calls).toBe(4);
    expect(running).toBe(0);
  });
  it("stops queued reads after unauthorized response", async () => {
    const read = vi.fn(async () => { throw Object.assign(new Error("Sign in"), { status: 401 }); });
    await expect(createFullResponseLoader(read)(Array.from({ length: 100 }, () => agent))).rejects.toMatchObject({ status: 401 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(read).toHaveBeenCalledTimes(4);
  });
});

describe("Mermaid document", () => {
  it("embeds complete source as inert data and preserves Unicode", () => {
    const source = long + '</script><script>alert("escape")</script>\u2028';
    const html = mermaidHtml(source);
    const encoded = html.match(/mermaid.render\('native-mermaid', (.*)\);/)![1];
    expect(JSON.parse(encoded)).toBe(source);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain("securityLevel:'strict'");
  });
});
