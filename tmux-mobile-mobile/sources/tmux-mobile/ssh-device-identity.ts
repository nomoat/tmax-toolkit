export const SSH_DEVICE_INSTALL_MARKER_KEY = "tmux-mobile.ssh-device-install.v1";

export type SshDeviceIdentity = {
  identityId: string;
  deviceId: string;
  publicKey: string;
  fingerprint: string;
};

export type SshDeviceIdentityDependencies = {
  getInstallMarker(): Promise<string | null>;
  setInstallMarker(value: string): Promise<void>;
  ensureNativeIdentity(
    installMarker: string | null,
  ): Promise<SshDeviceIdentity>;
};

function validateIdentity(value: SshDeviceIdentity): SshDeviceIdentity {
  if (
    !value ||
    typeof value.identityId !== "string" ||
    !value.identityId ||
    value.deviceId !== value.identityId ||
    typeof value.publicKey !== "string" ||
    !value.publicKey.startsWith("ssh-") ||
    typeof value.fingerprint !== "string" ||
    !value.fingerprint
  ) {
    throw new Error("The native Blink SSH identity is invalid.");
  }
  return value;
}

export async function ensureSshDeviceIdentity(
  dependencies: SshDeviceIdentityDependencies,
): Promise<SshDeviceIdentity> {
  const installMarker = await dependencies.getInstallMarker();
  const identity = validateIdentity(
    await dependencies.ensureNativeIdentity(installMarker),
  );
  if (installMarker !== identity.deviceId) {
    await dependencies.setInstallMarker(identity.deviceId);
  }
  return identity;
}

export function createSshDeviceIdentityManager(
  dependencies: SshDeviceIdentityDependencies,
): { ensure(): Promise<SshDeviceIdentity> } {
  let pending: Promise<SshDeviceIdentity> | null = null;
  return {
    ensure() {
      if (!pending) {
        pending = ensureSshDeviceIdentity(dependencies).catch((error) => {
          pending = null;
          throw error;
        });
      }
      return pending;
    },
  };
}
