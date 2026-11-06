import { describe, expect, it } from "vitest";
import { deployedRevisionCommit } from "./deployed-revision.js";

describe("Controller revision provenance", () => {
  it.each(["09c9904-20261106T120000Z", "09c9904-skills-20261106"])("resolves the committed source for %s", revision => {
    expect(deployedRevisionCommit(revision)).toBe("09c9904");
  });
  it.each([undefined, "dev", "09c9904-dirty", "09c9904-dirty-skills-20261106", "09c9904-skills-20261106-dirty", "09c9904-unknown", "main-skills-20261106"])("rejects an unverified revision %s", revision => {
    expect(deployedRevisionCommit(revision)).toBeNull();
  });
});
