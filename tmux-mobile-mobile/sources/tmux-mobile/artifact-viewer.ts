import type { ArtifactPin } from "./types";

export type ArtifactOpenMode = "image" | "markdown" | "text" | "browser";

const NATIVE_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".heic",
  ".heif",
]);
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".log",
  ".json",
  ".jsonl",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
]);

function pinExtension(pin: ArtifactPin): string {
  const explicit = String(pin.ext || "").trim().toLowerCase();
  if (explicit) return explicit.startsWith(".") ? explicit : `.${explicit}`;
  const match = /\.[a-z0-9]+$/i.exec(String(pin.name || "").trim());
  return match?.[0]?.toLowerCase() || "";
}

export function artifactOpenMode(pin: ArtifactPin): ArtifactOpenMode {
  const kind = String(pin.kind || "").toLowerCase();
  const contentType = String(pin.contentType || "").toLowerCase();
  const ext = pinExtension(pin);

  if (
    kind === "image" ||
    NATIVE_IMAGE_EXTENSIONS.has(ext) ||
    (/^image\//.test(contentType) && contentType !== "image/svg+xml")
  ) {
    return "image";
  }
  if (kind === "markdown" || /^text\/markdown\b/.test(contentType) || ext === ".md") {
    return "markdown";
  }
  if (/^text\/plain\b/.test(contentType) || TEXT_EXTENSIONS.has(ext)) {
    return "text";
  }
  return "browser";
}

export function controllerArtifactRawUrl(baseUrl: string, shareUrl: string): string {
  const base = new URL(baseUrl);
  const target = new URL(shareUrl, base);
  if (target.origin !== base.origin || !["/pin", "/api/pin"].includes(target.pathname)) {
    return "";
  }
  target.searchParams.set("raw", "1");
  return target.toString();
}
