export type FilePathTextPart =
  | { kind: "text"; text: string }
  | { kind: "file"; text: string; path: string };

export type LinkableTextPart =
  | FilePathTextPart
  | { kind: "url"; text: string; href: string };

const VIEWABLE_FILE_EXTS =
  "png|jpe?g|gif|svg|webp|bmp|ico|md|markdown|mdown|mkd|webm|mp4|m4v|mov|wav|mp3|ogg|m4a|aac|flac|html?";

const VIEWABLE_FILE_EXT_RE = new RegExp(String.raw`\.(?:${VIEWABLE_FILE_EXTS})$`, "i");
export const MARKDOWN_FILE_EXT_RE = /\.(md|markdown|mdown|mkd)$/i;
export const OVERLAY_VIEWER_EXT_RE = /\.(png|jpe?g|gif|svg|webp|bmp|ico|html?)$/i;

const SEG = String.raw`[^\s<>"'(){}\[\]:/]`;
const WRAP = String.raw`(?:\n[ \t]*)?`;
const FILE_PATH_RE = new RegExp(
  String.raw`(?:\.{0,2}\/|~\/)?(?:${SEG}+\/${WRAP})*${SEG}+\.(?:${VIEWABLE_FILE_EXTS})\b`,
  "gi",
);
const WEB_URL_RE = /https?:\/\/[^\s<>"'`。，、；：！？…]+/gi;
const ABSOLUTE_OR_HOME_RE = /^(?:\/|~\/)/;
const DEFAULT_IMAGE_HANDLER_TEMP_PATH_RE = /^https?:\/\/((?:\.\.\/)+var\/folders\/.+)$/i;
const DAMAGED_UPLOAD_TEMP_PATH_RE = /^(?:\.\.\/)+(var\/folders\/)/;
const ANSI_ESCAPE_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const SENTENCE_TAIL_RE = /[.,;:!?。，、；：！？…]+$/u;
const DANGLING_CLOSER_RE = /[\])}>」』”’）》】]+$/u;
const HTML_ENTITIES: Array<[string, string]> = [
  ["&quot;", '"'],
  ["&#034;", '"'],
  ["&#34;", '"'],
  ["&#039;", "'"],
  ["&#39;", "'"],
  ["&apos;", "'"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&amp;", "&"],
];
const WRAPPER_PAIRS: Array<[string, string]> = [
  ["`", "`"],
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["<", ">"],
  ["（", "）"],
  ["【", "】"],
  ["「", "」"],
  ["『", "』"],
  ["《", "》"],
];

function isProbablyUrlPath(text: string, index: number, match: string): boolean {
  if (/^www\./i.test(match)) return true;
  const before = text.slice(Math.max(0, index - 64), index);
  return /(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s]*$/i.test(before);
}

export function splitFilePathText(text: string): FilePathTextPart[] {
  const input = String(text || "");
  const parts: FilePathTextPart[] = [];
  let lastEnd = 0;
  FILE_PATH_RE.lastIndex = 0;

  for (let match = FILE_PATH_RE.exec(input); match; match = FILE_PATH_RE.exec(input)) {
    const visible = match[0];
    const start = match.index;
    const end = start + visible.length;
    if (isProbablyUrlPath(input, start, visible)) continue;

    if (start > lastEnd) parts.push({ kind: "text", text: input.slice(lastEnd, start) });
    parts.push({
      kind: "file",
      text: visible,
      path: cleanArtifactPath(visible),
    });
    lastEnd = end;
  }

  if (lastEnd < input.length) parts.push({ kind: "text", text: input.slice(lastEnd) });
  return parts.length ? parts : [{ kind: "text", text: input }];
}

function trimBareWebUrl(value: string): string {
  let out = String(value || "").replace(SENTENCE_TAIL_RE, "");
  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];
  for (const [open, close] of pairs) {
    while (
      out.endsWith(close) &&
      out.split(close).length - 1 > out.split(open).length - 1
    ) {
      out = out.slice(0, -1);
    }
  }
  return out.replace(/[」』”’）》】]+$/u, "");
}

function appendFilePathParts(parts: LinkableTextPart[], text: string): void {
  if (!text) return;
  parts.push(...splitFilePathText(text));
}

export function splitLinkableText(text: string): LinkableTextPart[] {
  const input = String(text || "");
  const parts: LinkableTextPart[] = [];
  let lastEnd = 0;
  WEB_URL_RE.lastIndex = 0;

  for (let match = WEB_URL_RE.exec(input); match; match = WEB_URL_RE.exec(input)) {
    const visible = match[0];
    const href = trimBareWebUrl(visible);
    try {
      const parsed = new URL(href);
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname) continue;
    } catch {
      continue;
    }

    appendFilePathParts(parts, input.slice(lastEnd, match.index));
    parts.push({ kind: "url", text: href, href });
    appendFilePathParts(parts, visible.slice(href.length));
    lastEnd = match.index + visible.length;
  }

  appendFilePathParts(parts, input.slice(lastEnd));
  return parts.length ? parts : [{ kind: "text", text: input }];
}

function decodeCommonHtmlEntities(value: string): string {
  let out = String(value || "");
  for (const [entity, char] of HTML_ENTITIES) {
    out = out.split(entity).join(char);
  }
  return out;
}

function stripOuterWrappers(value: string): string {
  let out = String(value || "").trim();
  let changed = true;
  while (changed && out.length >= 2) {
    changed = false;
    for (const [open, close] of WRAPPER_PAIRS) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(open.length, out.length - close.length).trim();
        changed = true;
        break;
      }
    }
  }
  return out;
}

function stripMarkdownLink(value: string): string {
  const out = String(value || "").trim();
  const match = out.match(/^!?\[[^\]\n]*\]\(([\s\S]+)\)$/);
  if (!match) return out;
  let target = match[1]?.trim() || "";
  if (target.startsWith("<")) {
    const close = target.indexOf(">");
    if (close > 0) return target.slice(1, close).trim();
  }
  const titled = target.match(/^([^"' \t\r\n][\s\S]*?)\s+["'][\s\S]*["']$/);
  if (titled) target = titled[1]?.trim() || "";
  return target;
}

function stripFileUrl(value: string): string {
  const out = String(value || "").trim();
  if (!/^file:\/\//i.test(out)) return out;
  try {
    return decodeURIComponent(new URL(out).pathname || "");
  } catch {
    return out.replace(/^file:\/\//i, "");
  }
}

export function cleanArtifactPath(value: string): string {
  let out = String(value || "")
    .replace(ANSI_ESCAPE_RE, "")
    .replace(/\/\r?\n[ \t]*/g, "/")
    .trim();
  if (!out) return "";

  for (let i = 0; i < 6; i += 1) {
    const before = out;
    out = out.replace(/^```[A-Za-z0-9_-]*[ \t]*(?:\r?\n)?/, "");
    out = out.replace(/(?:\r?\n)?```$/g, "");
    out = decodeCommonHtmlEntities(out);
    out = out.replace(SENTENCE_TAIL_RE, "").trim();
    out = stripMarkdownLink(out);
    out = stripOuterWrappers(out);
    out = stripFileUrl(out);
    out = out.replace(SENTENCE_TAIL_RE, "").trim();
    out = out.replace(DANGLING_CLOSER_RE, "").trim();
    out = stripOuterWrappers(out);
    if (out === before) break;
  }

  return repairUploadTempPath(out);
}

function decodePathPart(pathPart: string): string {
  try {
    return decodeURI(pathPart);
  } catch {
    return pathPart;
  }
}

function repairUploadTempPath(filePath: string): string {
  return String(filePath || "").replace(DAMAGED_UPLOAD_TEMP_PATH_RE, "/$1");
}

function dirname(filePath: string): string {
  const clean = String(filePath || "").split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const slash = clean.lastIndexOf("/");
  if (slash <= 0) return slash === 0 ? "/" : "";
  return clean.slice(0, slash);
}

function normalizeJoinedPath(filePath: string): string {
  const absolute = filePath.startsWith("/");
  const segments = filePath.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (out.length && out[out.length - 1] !== "..") {
        out.pop();
      } else if (!absolute) {
        out.push("..");
      }
      continue;
    }
    out.push(segment);
  }
  return `${absolute ? "/" : ""}${out.join("/")}` || (absolute ? "/" : ".");
}

export function resolveLinkedFilePath(filePath: string, basePath = ""): string {
  const clean = cleanArtifactPath(filePath);
  if (!clean || ABSOLUTE_OR_HOME_RE.test(clean) || !basePath) return clean;
  const baseDir = dirname(basePath);
  if (!baseDir) return clean;
  return normalizeJoinedPath(`${baseDir}/${clean}`);
}

export function filePathFromLocalHref(href: string, basePath = ""): string {
  let raw = cleanArtifactPath(String(href || "").trim());
  if (!raw || raw.startsWith("#") || raw.startsWith("//")) return "";
  const damagedTempPath = raw.match(DEFAULT_IMAGE_HANDLER_TEMP_PATH_RE);
  if (damagedTempPath) {
    raw = damagedTempPath[1] || "";
  } else if (/^file:\/\//i.test(raw)) {
    try {
      raw = new URL(raw).pathname;
    } catch {
      raw = raw.replace(/^file:\/\//i, "");
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return "";
  }
  const pathPart = raw.split(/[?#]/, 1)[0];
  const cleanPathPart = cleanArtifactPath(pathPart);
  if (!VIEWABLE_FILE_EXT_RE.test(cleanPathPart)) return "";
  return resolveLinkedFilePath(decodePathPart(cleanPathPart), basePath);
}

export function fileViewerEndpoint(filePath: string): string {
  const clean = cleanArtifactPath(filePath).split(/[?#]/, 1)[0];
  if (MARKDOWN_FILE_EXT_RE.test(clean)) return "/api/file-view";
  if (OVERLAY_VIEWER_EXT_RE.test(clean)) return "/api/file-page";
  return "/api/file-raw";
}
