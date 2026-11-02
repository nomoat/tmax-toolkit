import fs from "node:fs";
import { describe, expect, it } from "vitest";
import appConfig from "../../app.config.js";
import packageJson from "../../package.json";

describe("release version consistency", () => {
  it("keeps Expo, package, and every Xcode configuration on the same marketing version", () => {
    const project = fs.readFileSync(
      new URL("../../ios/CJMUX.xcodeproj/project.pbxproj", import.meta.url),
      "utf8",
    );
    const xcodeVersions = [
      ...project.matchAll(/MARKETING_VERSION = ([^;]+);/g),
    ].map((match) => match[1]);

    expect(appConfig.expo.version).toBe(packageJson.version);
    expect(xcodeVersions.length).toBeGreaterThan(0);
    expect(new Set(xcodeVersions)).toEqual(new Set([packageJson.version]));
  });
});
