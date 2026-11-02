import { describe, expect, it } from "vitest";
import { artifactOpenMode, controllerArtifactRawUrl } from "./artifact-viewer";

describe("mobile artifact viewer routing", () => {
  it("opens common raster images inside the app", () => {
    expect(artifactOpenMode({ id: "1", shareUrl: "/pin?token=one", name: "shot.PNG" })).toBe("image");
    expect(artifactOpenMode({ id: "2", shareUrl: "/pin?token=two", kind: "image", contentType: "image/png" })).toBe("image");
  });

  it("renders markdown and plain text natively but keeps HTML in the browser", () => {
    expect(artifactOpenMode({ id: "1", shareUrl: "/pin?token=one", kind: "markdown" })).toBe("markdown");
    expect(artifactOpenMode({ id: "2", shareUrl: "/pin?token=two", name: "events.jsonl" })).toBe("text");
    expect(artifactOpenMode({ id: "3", shareUrl: "/pin?token=three", contentType: "text/html" })).toBe("browser");
    expect(artifactOpenMode({ id: "4", shareUrl: "/pin?token=four", contentType: "image/svg+xml" })).toBe("browser");
  });

  it("builds only same-controller raw pin URLs", () => {
    expect(controllerArtifactRawUrl("https://eng.impo.ai", "/pin?token=abc")).toBe(
      "https://eng.impo.ai/pin?token=abc&raw=1",
    );
    expect(controllerArtifactRawUrl("https://eng.impo.ai", "https://evil.example/pin?token=abc")).toBe("");
    expect(controllerArtifactRawUrl("https://eng.impo.ai", "/other?token=abc")).toBe("");
  });
});
