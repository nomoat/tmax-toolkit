import { describe, expect, it } from "vitest";

import {
  fileBrowserLocationLabel,
  isFileBrowserImage,
  isFileBrowserMarkdown,
  joinFileBrowserPath,
  parentFileBrowserPath,
} from "./file-browser";

describe("file browser navigation", () => {
  it("joins and backs out of relative paths without escaping the root", () => {
    expect(joinFileBrowserPath("sources/app", "components")).toBe("sources/app/components");
    expect(joinFileBrowserPath("", "sources")).toBe("sources");
    expect(parentFileBrowserPath("sources/app/components")).toBe("sources/app");
    expect(parentFileBrowserPath("sources")).toBe("");
    expect(parentFileBrowserPath("")).toBe("");
  });

  it("shows the fixed browser root with the current relative path", () => {
    expect(fileBrowserLocationLabel("/Users/cj/src/cc/", "sources/app")).toBe(
      "/Users/cj/src/cc/sources/app",
    );
    expect(fileBrowserLocationLabel("/", "etc")).toBe("/etc");
  });

  it("classifies preview icons", () => {
    expect(isFileBrowserImage("out/shot.PNG")).toBe(true);
    expect(isFileBrowserMarkdown("docs/README.md")).toBe(true);
    expect(isFileBrowserMarkdown("src/index.ts")).toBe(false);
  });
});
