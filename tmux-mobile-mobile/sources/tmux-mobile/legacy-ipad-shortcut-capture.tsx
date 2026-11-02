import * as React from "react";
import { AppState, StyleSheet, TextInput } from "react-native";

const styles = StyleSheet.create({
  hidden: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    top: 0,
    left: 0,
  },
});

export function LegacyIPadShortcutCapture({
  enabled,
  onKeyDown,
}: {
  enabled: boolean;
  onKeyDown: (event: { nativeEvent: { key: string } }) => void;
}) {
  const inputRef = React.useRef<TextInput>(null);
  const focusTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestFocus = React.useCallback(() => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      inputRef.current?.focus();
    }, 50);
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      inputRef.current?.blur();
      return;
    }
    requestFocus();
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [enabled, requestFocus]);

  React.useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") requestFocus();
    });
    return () => subscription.remove();
  }, [enabled, requestFocus]);

  if (!enabled) return null;

  return (
    <TextInput
      ref={inputRef}
      autoFocus
      value=""
      onChangeText={() => {}}
      onKeyPress={(event) => {
        onKeyDown({ nativeEvent: { key: event.nativeEvent.key } });
      }}
      showSoftInputOnFocus={false}
      caretHidden
      contextMenuHidden
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.hidden}
    />
  );
}
