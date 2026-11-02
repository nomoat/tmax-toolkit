export function joinFileBrowserPath(parent: string, name: string): string {
  const cleanParent = String(parent || "").replace(/^\/+|\/+$/g, "");
  const cleanName = String(name || "").replace(/^\/+|\/+$/g, "");
  return [cleanParent, cleanName].filter(Boolean).join("/");
}

export function parentFileBrowserPath(relativePath: string): string {
  const parts = String(relativePath || "")
    .split("/")
    .filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function fileBrowserLocationLabel(root: string, relativePath: string): string {
  const normalizedRoot = String(root || "").replace(/\/+$/g, "") || "/";
  if (!relativePath) return normalizedRoot;
  return `${normalizedRoot === "/" ? "" : normalizedRoot}/${relativePath}`;
}

export function isFileBrowserImage(path: string): boolean {
  return /\.(avif|bmp|gif|heic|ico|jpe?g|png|svg|webp)$/i.test(path);
}

export function isFileBrowserMarkdown(path: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(path);
}
