import { agentMachineKey, type AgentSession, type AgentTranscriptResponse } from "./types";

// Inventory previews have a 4096-byte budget; a final UTF-8 character may
// leave up to three bytes unused. Never use that preview as a whole response.
export function needsFullResponse(agent: AgentSession): boolean {
  return Boolean(agent.lastAssistantTruncated || agent.lastUserTruncated ||
    [agent.lastAssistantText, agent.lastUserText].some(text =>
      utf8Bytes(text || "") >= 4093));
}

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw Object.assign(new Error("Request cancelled"), { name: "AbortError" });
}

type ReadTranscript = (machineId: string, paneId: string, mux: string, signal?: AbortSignal) => Promise<AgentTranscriptResponse>;

export function createFullResponseLoader(read: ReadTranscript, concurrency = 4) {
  let running = 0;
  const queue: Array<() => void> = [];
  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const start = () => {
      running++;
      task().then(resolve, reject).finally(() => {
        running--;
        queue.shift()?.();
      });
    };
    if (running < concurrency) start();
    else queue.push(start);
  });

  return async (agents: AgentSession[], signal?: AbortSignal) => {
    let unauthorized = false;
    return Promise.all(agents.map(agent => {
      if (!needsFullResponse(agent)) return agent;
      return enqueue(async () => {
        checkAborted(signal);
        if (unauthorized) throw new Error("Sign in again to load complete responses.");
        try {
          if (!agent.paneId) throw new Error("No transcript target");
          const { result } = await read(agentMachineKey(agent), agent.paneId, agent.mux || "tmux", signal);
          checkAborted(signal);
          if (!result || (agent.agentSessionId && result.sessionId !== agent.agentSessionId)) {
            throw new Error("Session changed. Refresh to retry.");
          }
          const turns = result.turns || [];
          const assistant = [...turns].reverse().find(turn => turn.role === "assistant");
          const user = [...turns].reverse().find(turn => turn.role === "user");
          if (agent.lastAssistantText && !assistant?.text) throw new Error("Complete response unavailable");
          if (agent.lastUserText && !user?.text) throw new Error("Complete prompt unavailable");
          return {
            ...agent,
            ...(assistant ? { lastAssistantText: assistant.text, lastAssistantAt: assistant.t } : {}),
            ...(user ? { lastUserText: user.text, lastUserAt: user.t } : {}),
            fullTextError: "",
          };
        } catch (error) {
          checkAborted(signal);
          if ((error as { status?: number }).status === 401) {
            unauthorized = true;
            throw error;
          }
          return { ...agent, fullTextError: error instanceof Error ? error.message : String(error) };
        }
      });
    }));
  };
}
