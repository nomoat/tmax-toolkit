import { describe, expect, it } from "vitest";
import {
  cleanArtifactPath,
  filePathFromLocalHref,
  fileViewerEndpoint,
  resolveLinkedFilePath,
  splitFilePathText,
  splitLinkableText,
} from "./file-links";

describe("file link parsing", () => {
  it("keeps uploaded absolute temp paths absolute", () => {
    const path = "/var/folders/xc/25jxs2fj27z1xy_4y5krmt6w0000gn/T/tmux-mobile-uploads/IMG_4509.png";

    expect(filePathFromLocalHref(path)).toBe(path);
    expect(splitFilePathText(`see ${path}`)).toContainEqual({
      kind: "file",
      text: path,
      path,
    });
  });

  it("repairs temp paths damaged by relative/default image handlers", () => {
    const repaired =
      "/var/folders/xc/25jxs2fj27z1xy_4y5krmt6w0000gn/T/tmux-mobile-uploads/IMG_4509.png";

    expect(resolveLinkedFilePath("../var/folders/xc/25jxs2fj27z1xy_4y5krmt6w0000gn/T/tmux-mobile-uploads/IMG_4509.png")).toBe(repaired);
    expect(filePathFromLocalHref("https://../var/folders/xc/25jxs2fj27z1xy_4y5krmt6w0000gn/T/tmux-mobile-uploads/IMG_4509.png")).toBe(repaired);
  });

  it("resolves markdown-relative assets against the current file", () => {
    expect(filePathFromLocalHref("images/chart.png", "/Users/homo/src/report/readme.md")).toBe(
      "/Users/homo/src/report/images/chart.png",
    );
    expect(filePathFromLocalHref("../chart.png", "/Users/homo/src/report/readme.md")).toBe(
      "/Users/homo/src/chart.png",
    );
  });

  it("cleans agent-authored artifact paths before local extension checks", () => {
    expect(cleanArtifactPath("./dist/index.html。")).toBe("./dist/index.html");
    expect(cleanArtifactPath("`./dist/index.html`, ")).toBe("./dist/index.html");
    expect(cleanArtifactPath("[open](./dist/index.html).")).toBe("./dist/index.html");
    expect(cleanArtifactPath("&quot;./report.html&quot;")).toBe("./report.html");
    expect(cleanArtifactPath("docs/design/\n  report.html")).toBe("docs/design/report.html");
    expect(cleanArtifactPath("file:///tmp/report.html")).toBe("/tmp/report.html");
  });

  it("routes dirty local hrefs to file viewers", () => {
    expect(filePathFromLocalHref("./dist/index.html。")).toBe("./dist/index.html");
    expect(filePathFromLocalHref("[open](./dist/index.html).")).toBe("./dist/index.html");
    expect(filePathFromLocalHref("./My%20Report.html#preview")).toBe("./My Report.html");
    expect(fileViewerEndpoint("./dist/index.html。")).toBe("/api/file-page");
  });

  it("makes bare web URLs linkable without swallowing sentence punctuation", () => {
    expect(splitLinkableText("打开 https://bilingual-video-notes.pages.dev/。然后验证")).toEqual([
      { kind: "text", text: "打开 " },
      {
        kind: "url",
        text: "https://bilingual-video-notes.pages.dev/",
        href: "https://bilingual-video-notes.pages.dev/",
      },
      { kind: "text", text: "。然后验证" },
    ]);
  });

  it("handles multiple URLs and preserves balanced URL parentheses", () => {
    expect(splitLinkableText("https://example.com/a_(b) and http://example.org/x)."))
      .toEqual([
        {
          kind: "url",
          text: "https://example.com/a_(b)",
          href: "https://example.com/a_(b)",
        },
        { kind: "text", text: " and " },
        {
          kind: "url",
          text: "http://example.org/x",
          href: "http://example.org/x",
        },
        { kind: "text", text: ")." },
      ]);
  });

  it("does not mistake local artifacts or incomplete URLs for web links", () => {
    expect(splitLinkableText("see ./dist/index.html and https://")).toEqual([
      { kind: "text", text: "see " },
      { kind: "file", text: "./dist/index.html", path: "./dist/index.html" },
      { kind: "text", text: " and https://" },
    ]);
  });
});
