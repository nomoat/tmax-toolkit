import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureCJMUXBlinkSSHManagedIdentity } from "../../modules/cjmux-blink-terminal";
import {
  createSshDeviceIdentityManager,
  SSH_DEVICE_INSTALL_MARKER_KEY,
} from "./ssh-device-identity";

export const sshDeviceIdentityManager = createSshDeviceIdentityManager({
  getInstallMarker: () => AsyncStorage.getItem(SSH_DEVICE_INSTALL_MARKER_KEY),
  setInstallMarker: (value) =>
    AsyncStorage.setItem(SSH_DEVICE_INSTALL_MARKER_KEY, value),
  ensureNativeIdentity: ensureCJMUXBlinkSSHManagedIdentity,
});
