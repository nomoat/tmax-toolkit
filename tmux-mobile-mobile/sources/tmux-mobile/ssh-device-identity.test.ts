import { describe, expect, it, vi } from "vitest";
import {
  createSshDeviceIdentityManager,
  ensureSshDeviceIdentity,
  type SshDeviceIdentity,
} from "./ssh-device-identity";

const FIRST_IDENTITY: SshDeviceIdentity = {
  identityId: "first-install",
  deviceId: "first-install",
  publicKey: "ssh-ed25519 AAAA-first cjmux",
  fingerprint: "SHA256:first",
};

const SECOND_IDENTITY: SshDeviceIdentity = {
  identityId: "second-install",
  deviceId: "second-install",
  publicKey: "ssh-ed25519 AAAA-second cjmux",
  fingerprint: "SHA256:second",
};

function memoryDependencies(input?: {
  marker?: string | null;
  identities?: SshDeviceIdentity[];
}) {
  let marker = input?.marker ?? null;
  const identities = [...(input?.identities || [FIRST_IDENTITY])];
  const ensureNativeIdentity = vi.fn(async () => identities.shift() || FIRST_IDENTITY);
  return {
    dependencies: {
      getInstallMarker: async () => marker,
      setInstallMarker: async (value: string) => {
        marker = value;
      },
      ensureNativeIdentity,
    },
    ensureNativeIdentity,
    marker: () => marker,
  };
}

describe("SSH device identity", () => {
  it("records the native Keychain identity as this app installation", async () => {
    const memory = memoryDependencies();

    const identity = await ensureSshDeviceIdentity(memory.dependencies);

    expect(identity).toEqual(FIRST_IDENTITY);
    expect(memory.marker()).toBe(FIRST_IDENTITY.deviceId);
    expect(memory.ensureNativeIdentity).toHaveBeenCalledWith(null);
    expect(identity).not.toHaveProperty("privateKey");
  });

  it("passes an existing install marker to the native Keychain store", async () => {
    const memory = memoryDependencies({ marker: FIRST_IDENTITY.deviceId });

    await ensureSshDeviceIdentity(memory.dependencies);

    expect(memory.ensureNativeIdentity).toHaveBeenCalledWith(FIRST_IDENTITY.deviceId);
  });

  it("adopts a rotated native identity when the install marker is gone", async () => {
    const memory = memoryDependencies({
      marker: null,
      identities: [SECOND_IDENTITY],
    });

    const identity = await ensureSshDeviceIdentity(memory.dependencies);

    expect(identity).toEqual(SECOND_IDENTITY);
    expect(memory.marker()).toBe(SECOND_IDENTITY.deviceId);
  });

  it("coalesces concurrent requests", async () => {
    const memory = memoryDependencies();
    const manager = createSshDeviceIdentityManager(memory.dependencies);

    const [first, second] = await Promise.all([manager.ensure(), manager.ensure()]);

    expect(first).toBe(second);
    expect(memory.ensureNativeIdentity).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed native identity metadata", async () => {
    const memory = memoryDependencies({
      identities: [{ ...FIRST_IDENTITY, publicKey: "not-an-ssh-key" }],
    });

    await expect(ensureSshDeviceIdentity(memory.dependencies)).rejects.toThrow(
      "native Blink SSH identity is invalid",
    );
  });
});
