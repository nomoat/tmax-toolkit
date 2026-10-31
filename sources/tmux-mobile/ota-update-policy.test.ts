import { describe, expect, it } from "vitest";
import { otaUpdatePolicy } from "@/tmux-mobile/ota-update-policy";

describe("otaUpdatePolicy", () => {
  it("keeps in-place reloads off iOS", () => {
    expect(otaUpdatePolicy(false)).toMatchObject({
      applyMode: "reload",
      applyLabel: "Apply",
      readyTitle: "Update ready",
    });
  });

  it("requires a cold start on every iOS device instead of an in-place reload", () => {
    const policy = otaUpdatePolicy(true);

    expect(policy.applyMode).toBe("cold-start");
    expect(policy.applyLabel).toBe("Restart app");
    expect(policy.readyTitle).toBe("Update downloaded");
    expect(policy.readyMessage).toContain("Fully quit T-MAX");
    expect(policy.readyMessage).toContain("iOS");
  });
});
