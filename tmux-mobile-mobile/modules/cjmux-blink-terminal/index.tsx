import * as React from "react";
import { requireOptionalNativeModule } from "expo";
import { requireNativeViewManager } from "expo-modules-core";
import {
  Platform,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";

export type BlinkTerminalState =
  | "idle"
  | "connecting"
  | "verifying-host"
  | "authenticating"
  | "connected"
  | "disconnected"
  | "failed";

export type BlinkTerminalStatusEvent = {
  state: BlinkTerminalState;
  message?: string;
};

export type BlinkHostKeyEvent = {
  fingerprint: string;
  changed: boolean;
};

export type BlinkTerminalExitEvent = {
  reason?: string;
};

export type BlinkTerminalHandle = {
  focus(): Promise<void>;
  blur(): Promise<void>;
  reconnect(): Promise<void>;
  disconnect(): Promise<void>;
  approveHostKey(accepted: boolean): Promise<void>;
  sendText(text: string, submit: boolean): Promise<void>;
  sendKey(key: string): Promise<void>;
  paste(): Promise<void>;
};

export type BlinkSSHManagedIdentity = {
  identityId: string;
  deviceId: string;
  publicKey: string;
  fingerprint: string;
};

type NativeBlinkTerminalModule = {
  ensureManagedIdentity(
    installMarker: string | null,
  ): Promise<BlinkSSHManagedIdentity>;
};

type NativeBlinkTerminalProps = ViewProps & {
  host: string;
  user: string;
  port: number;
  password?: string;
  privateKey?: string;
  identityId?: string;
  command?: string;
  connectionKey: string;
  autoFocus?: boolean;
  colorScheme?: "light" | "dark";
  fontSize?: number;
  onReady?: (event: NativeSyntheticEvent<Record<string, never>>) => void;
  onStateChange?: (
    event: NativeSyntheticEvent<BlinkTerminalStatusEvent>,
  ) => void;
  onHostKeyPrompt?: (
    event: NativeSyntheticEvent<BlinkHostKeyEvent>,
  ) => void;
  onExit?: (event: NativeSyntheticEvent<BlinkTerminalExitEvent>) => void;
};

const nativeModule =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<NativeBlinkTerminalModule>(
        "CJMUXBlinkTerminal",
      )
    : null;

const NativeBlinkTerminal = nativeModule
  ? (requireNativeViewManager<NativeBlinkTerminalProps>(
      "CJMUXBlinkTerminal",
    ) as React.ComponentType<
      NativeBlinkTerminalProps & React.RefAttributes<BlinkTerminalHandle>
    >)
  : null;

export const hasNativeCJMUXBlinkTerminal = NativeBlinkTerminal !== null;

export async function ensureCJMUXBlinkSSHManagedIdentity(
  installMarker: string | null,
): Promise<BlinkSSHManagedIdentity> {
  if (!nativeModule) {
    throw new Error("The native Blink SSH module is unavailable on this device.");
  }
  return nativeModule.ensureManagedIdentity(installMarker);
}

export const CJMUXBlinkTerminal = React.forwardRef<
  BlinkTerminalHandle,
  NativeBlinkTerminalProps
>(function CJMUXBlinkTerminal(props, ref) {
  if (!NativeBlinkTerminal) {
    return <View style={props.style} />;
  }

  return <NativeBlinkTerminal {...props} ref={ref} />;
});
