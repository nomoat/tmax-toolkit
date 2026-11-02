import * as React from "react";
import { requireOptionalNativeModule } from "expo";
import { requireNativeViewManager } from "expo-modules-core";
import {
  Platform,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";

export type CJMUXKeyboardShortcutMode = "all" | "escape" | "none";

export type CJMUXKeyboardShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
};

type NativeShortcutViewProps = ViewProps & {
  mode: CJMUXKeyboardShortcutMode;
  onKeyDown?: (
    event: NativeSyntheticEvent<CJMUXKeyboardShortcutEvent>,
  ) => void;
};

const nativeModule =
  Platform.OS === "ios"
    ? requireOptionalNativeModule("CJMUXKeyboardShortcuts")
    : null;

const NativeShortcutView = nativeModule
  ? requireNativeViewManager<NativeShortcutViewProps>(
      "CJMUXKeyboardShortcuts",
    )
  : null;

export const hasNativeCJMUXKeyboardShortcuts = NativeShortcutView !== null;

export function CJMUXKeyboardShortcutSurface({
  mode,
  onShortcutKeyDown,
  ...viewProps
}: ViewProps & {
  mode: CJMUXKeyboardShortcutMode;
  onShortcutKeyDown: (event: {
    nativeEvent: CJMUXKeyboardShortcutEvent;
  }) => void;
}) {
  if (!NativeShortcutView || mode === "none") {
    return <View {...viewProps} />;
  }

  return (
    <NativeShortcutView
      {...viewProps}
      mode={mode}
      onKeyDown={(
        event: NativeSyntheticEvent<CJMUXKeyboardShortcutEvent>,
      ) =>
        onShortcutKeyDown({
          nativeEvent: event.nativeEvent,
        })
      }
    />
  );
}
