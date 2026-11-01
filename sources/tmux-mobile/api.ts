import { terminalShareRequest, type TerminalShareAction, type TerminalShareState } from "./terminal-share";
import type { AgentSession } from "./types";
import { migrateControllerOrigin } from "./controller-origin";
import Constants from "expo-constants";
import { createFullResponseLoader } from "./full-response";
import { EncodingType, FileSystemUploadType, getInfoAsync, readAsStringAsync, uploadAsync } from "expo-file-system/legacy";
import { toByteArray } from "base64-js";
import type {
  AgentFileResponse,
  AgentTranscriptResponse,
  FileBrowserResponse,
  PinArtifactResponse,
  CardStarsResponse,
  CommandCenterResponse,
  DeviceLoginResult,
  DeviceLoginStart,
  PaneCaptureResponse,
  PinsResponse,
  UserSnippetItem,
  UserSnippetsResponse,
  WindowViewResponse,
} from "./types";

export interface UploadFileInput {
  uri: string;
  name: string;
  type?: string | null;
}

export interface UploadFileResponse {
  url?: string;
  expiresAt?: string;
  size?: number;
  path?: string;
  name?: string;
}

interface DirectUploadPlan {
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
  ticket: string;
  uploadExpiresAt: string;
}

export interface TranscribeAudioResponse {
  text?: string;
  model?: string;
}

export interface AuthorizeSshInput {
  publicKey: string;
  deviceId: string;
  deviceLabel?: string;
}

export interface AuthorizeSshResponse {
  ok: true;
  authorized: true;
  installed: boolean;
  fingerprint: string;
  host: string;
  sshHosts: string[];
  user: string;
  port: number;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = toByteArray(base64);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status = 0, body: unknown = null) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function defaultControllerUrl(): string {
  const value = Constants.expoConfig?.extra?.tmuxMobileControllerUrl;
  return normalizeBaseUrl(typeof value === "string" ? value : "https://eng.xyznot.com");
}

export function normalizeBaseUrl(value: string): string {
  let next = String(value || "https://eng.xyznot.com").trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(next)) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(next);
    next = `${local ? "http" : "https"}://${next}`;
  }
  const url = new URL(next);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return migrateControllerOrigin(url.origin);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  machineId?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class TmuxMobileApi {
  private completeResponses = createFullResponseLoader((machineId, paneId, mux, signal) =>
    this.transcript(machineId, paneId, { latest: true, mux, signal }));
  readonly baseUrl: string;
  readonly token: string;

  constructor(baseUrl = defaultControllerUrl(), token = "") {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token;
  }

  url(pathname: string): URL {
    return new URL(pathname, this.baseUrl);
  }

  async request<T>(pathname: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...(options.headers || {}),
    };
    const token = options.token ?? this.token;
    if (token) headers.authorization = `Bearer ${token}`;
    if (options.machineId && options.machineId !== "local") {
      headers["x-machine-id"] = options.machineId;
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      const isBlob = typeof Blob !== "undefined" && options.body instanceof Blob;
      const isArrayBuffer = options.body instanceof ArrayBuffer;
      if (
        typeof options.body === "string" ||
        options.body instanceof FormData ||
        isBlob ||
        isArrayBuffer
      ) {
        body = options.body as BodyInit;
      } else {
        headers["content-type"] = "application/json";
        body = JSON.stringify(options.body);
      }
    }

    let response: Response;
    try {
      response = await fetch(this.url(pathname), {
        method: options.method || (body === undefined ? "GET" : "POST"),
        headers,
        body,
        signal: options.signal,
      });
    } catch (error) {
      throw new ApiError(
        `Could not connect to ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: unknown }).error)
          : `HTTP ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data as T;
  }

  publicPost<T>(pathname: string, body: unknown): Promise<T> {
    return this.request<T>(pathname, { method: "POST", body, token: "" });
  }

  startDeviceLogin(): Promise<DeviceLoginStart> {
    return this.publicPost<DeviceLoginStart>("/auth/device/start", {});
  }

  pollDeviceLogin(id: string): Promise<DeviceLoginResult> {
    return this.publicPost<DeviceLoginResult>("/auth/device/poll", { id });
  }

  runtime(): Promise<{ mode: "local" | "hub" }> {
    return this.request("/api/runtime");
  }

  browserHandoff(returnTo: string): Promise<{ handoffUrl: string; expiresIn?: number }> {
    return this.request("/auth/browser-handoff", {
      method: "POST",
      body: { returnTo },
    });
  }

  async commandCenter(machineId?: string, signal?: AbortSignal): Promise<CommandCenterResponse> {
    const data = await this.request<CommandCenterResponse>("/api/command-center", { machineId, signal });
    return { ...data, agents: await this.completeResponses(data.agents || [], signal) };
  }

  authorizeSsh(
    machineId: string,
    input: AuthorizeSshInput,
  ): Promise<AuthorizeSshResponse> {
    return this.request("/api/ssh/authorize", {
      method: "POST",
      machineId,
      body: input,
    });
  }

  cardStars(): Promise<CardStarsResponse> {
    return this.request("/api/card-stars");
  }

  updateCardStars(keys: string[]): Promise<CardStarsResponse> {
    return this.request("/api/card-stars", {
      method: "PUT",
      body: { keys },
    });
  }

  pins(): Promise<PinsResponse> {
    return this.request("/api/pins");
  }

  async artifactText(rawUrl: string, signal?: AbortSignal): Promise<string> {
    const target = new URL(rawUrl, this.baseUrl);
    if (
      target.origin !== this.baseUrl ||
      !["/pin", "/api/pin"].includes(target.pathname)
    ) {
      throw new ApiError("Refusing to send the session token to another origin");
    }
    let response: Response;
    try {
      response = await fetch(target, {
        headers: {
          accept: "text/plain, text/markdown, application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        signal,
      });
    } catch (error) {
      throw new ApiError(
        `Could not connect to ${this.baseUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = JSON.parse(text) as { error?: unknown };
        if (data.error) message = String(data.error);
      } catch {
        // Keep the HTTP status for non-JSON failures.
      }
      throw new ApiError(message, response.status, text);
    }
    return text;
  }

  pinInlineArtifact(input: {
    machineId?: string;
    text: string;
    name: string;
    sourcePath: string;
  }): Promise<PinArtifactResponse> {
    return this.request("/api/pins?inline=1", {
      method: "POST",
      machineId: input.machineId,
      body: {
        machineId: input.machineId,
        text: input.text,
        name: input.name,
        sourcePath: input.sourcePath,
      },
    });
  }

  renamePin(id: string, name: string): Promise<PinArtifactResponse> {
    return this.request(`/api/pins?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { name },
    });
  }

  deletePin(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/pins?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  snippets(): Promise<UserSnippetsResponse> {
    return this.request("/api/snippets");
  }

  updateSnippets(items: UserSnippetItem[]): Promise<UserSnippetsResponse> {
    return this.request("/api/snippets", {
      method: "PUT",
      body: { items },
    });
  }

  resetSnippets(): Promise<UserSnippetsResponse> {
    return this.request("/api/snippets", {
      method: "DELETE",
    });
  }

  file(machineId: string, paneId: string, path: string): Promise<AgentFileResponse> {
    const params = new URLSearchParams({ paneId, path });
    return this.request(`/api/file?${params.toString()}`, { machineId });
  }

  files(
    machineId: string,
    paneId: string,
    options?: { root?: string; path?: string },
  ): Promise<FileBrowserResponse> {
    const params = new URLSearchParams({ paneId });
    if (options?.root) params.set("root", options.root);
    if (options?.path) params.set("path", options.path);
    return this.request(`/api/files?${params.toString()}`, { machineId });
  }

  pinFileArtifact(input: {
    machineId: string;
    paneId: string;
    path: string;
  }): Promise<PinArtifactResponse> {
    const params = new URLSearchParams({ paneId: input.paneId, path: input.path });
    return this.request(`/api/pins?${params.toString()}`, {
      method: "POST",
      machineId: input.machineId,
      body: {},
    });
  }

  renameWindow(machineId: string, windowId: string, name: string): Promise<unknown> {
    return this.request("/api/windows", {
      method: "PATCH",
      machineId,
      body: { windowId, name },
    });
  }

  deleteWindow(machineId: string, windowId: string): Promise<unknown> {
    return this.request("/api/windows", {
      method: "DELETE",
      machineId,
      body: { windowId },
    });
  }

  sendText(machineId: string, paneId: string, text: string, enter = true, submitNudge = false): Promise<unknown> {
    return this.request("/api/send", {
      method: "POST",
      machineId,
      body: { paneId, text, enter, submitNudge },
    });
  }

  sendKey(machineId: string, paneId: string, key: string): Promise<unknown> {
    return this.request("/api/key", {
      method: "POST",
      machineId,
      body: { paneId, key },
    });
  }

  async uploadFile(
    machineId: string,
    paneId: string,
    file: UploadFileInput,
  ): Promise<UploadFileResponse> {
    const info = await getInfoAsync(file.uri);
    if (!info.exists) throw new Error("The selected file is no longer available. Please select it again.");
    let plan: DirectUploadPlan;
    try {
      plan = await this.request<DirectUploadPlan>("/api/uploads", {
        method: "POST",
        body: { name: file.name || "upload", size: info.size, contentType: file.type || "application/octet-stream" },
      });
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 501].includes(error.status)) throw error;
      // Local-only or older Controllers: still stream natively, never base64.
      const headers: Record<string, string> = { "content-type": file.type || "application/octet-stream" };
      if (this.token) headers.authorization = `Bearer ${this.token}`;
      if (machineId && machineId !== "local") headers["x-machine-id"] = machineId;
      const params = new URLSearchParams({ paneId, name: file.name || "upload" });
      const result = await uploadAsync(this.url(`/api/upload?${params}`).toString(), file.uri, {
        httpMethod: "POST", uploadType: FileSystemUploadType.BINARY_CONTENT, headers,
      });
      const body = JSON.parse(result.body || "{}");
      if (result.status < 200 || result.status >= 300) throw new ApiError(body.error || "File upload failed", result.status);
      return body;
    }
    // Native URLSession/OkHttp reads the file from disk. Only the signed upload
    // headers go to S3; the Controller bearer token never leaves this API.
    const result = await uploadAsync(plan.upload.url, file.uri, {
      httpMethod: plan.upload.method, uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers: plan.upload.headers,
    });
    if (result.status < 200 || result.status >= 300) throw new ApiError(
      result.status === 403 ? "Upload authorization expired or was rejected. Select the file again." : "File upload failed. Please try again.",
      result.status,
    );
    return this.request<UploadFileResponse>("/api/uploads/complete", {
      method: "POST", body: { ticket: plan.ticket },
    });
  }

  async transcribeAudio(
    machineId: string,
    file: { uri: string; type?: string | null },
  ): Promise<TranscribeAudioResponse> {
    const base64 = await readAsStringAsync(file.uri, { encoding: EncodingType.Base64 });
    return this.request<TranscribeAudioResponse>("/api/transcribe", {
      method: "POST",
      machineId,
      headers: {
        "content-type": file.type || "audio/wav",
        "x-idempotency-key": `mobile-voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
      body: base64ToArrayBuffer(base64),
    });
  }

  terminalShare(agent: AgentSession, action: TerminalShareAction, ttlSeconds = 86400, allowControl = true, signal?: AbortSignal): Promise<TerminalShareState> {
    return this.request('/api/terminal-share', { ...terminalShareRequest(agent, action, ttlSeconds, allowControl), signal });
  }

  windowView(machineId: string, windowId: string, lines = 120): Promise<WindowViewResponse> {
    const params = new URLSearchParams({ windowId, lines: String(lines) });
    return this.request(`/api/window-view?${params.toString()}`, { machineId });
  }

  capture(machineId: string, paneId: string, mode = "tail", lines = 260): Promise<PaneCaptureResponse> {
    const params = new URLSearchParams({ paneId, mode, lines: String(lines) });
    return this.request(`/api/capture?${params.toString()}`, { machineId });
  }

  transcript(machineId: string, paneId: string, options: { latest?: boolean; mux?: string; signal?: AbortSignal } = {}): Promise<AgentTranscriptResponse> {
    const params = new URLSearchParams({ paneId });
    if (options.latest) params.set("latest", "1");
    return this.request(`/api/agent-transcript?${params.toString()}`, {
      machineId, signal: options.signal, headers: { "x-mux": options.mux || "tmux" },
    });
  }

  startAgent(input: {
    machineId: string;
    kind: "claude" | "codex" | "pi";
    cwd: string;
    mux: string;
    sessionName?: string;
  }): Promise<unknown> {
    return this.request("/api/agent-sessions", {
      method: "POST",
      machineId: input.machineId,
      body: {
        kind: input.kind,
        cwd: input.cwd,
        mux: input.mux,
        sessionName: input.sessionName || "",
      },
    });
  }
}
