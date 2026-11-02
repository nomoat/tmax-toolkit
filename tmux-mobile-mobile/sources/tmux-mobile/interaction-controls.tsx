import * as React from 'react';
import { Pressable, StyleSheet, Switch, Text, type SwitchProps } from 'react-native';
import { X } from 'lucide-react-native';
import type { AppTheme } from '@/theme';
import { NATIVE_VISION_CONTROLS_DETECTED } from './vision-device';

export const VISION_TARGET_SIZE = 64;
export const VisionControlsContext = React.createContext(NATIVE_VISION_CONTROLS_DETECTED);
export const useVisionControls = () => React.useContext(VisionControlsContext);

export function controlIcon(icon: React.ReactNode, vision: boolean) {
  return vision && React.isValidElement<{ size?: number }>(icon)
    ? React.cloneElement(icon, { size: 26 })
    : icon;
}

// A visible, labelled target for gaze selection; hitSlop alone does not help.
export function CloseButton({ theme, onPress, accessibilityLabel = 'Close' }: {
  theme: AppTheme; onPress: () => void; accessibilityLabel?: string;
}) {
  const vision = useVisionControls();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    onPress={onPress} style={({ pressed }) => [styles.close, vision && styles.visionClose, {
      backgroundColor: pressed ? theme.colors.surfaceMuted : vision ? theme.colors.surfaceRaised : 'transparent',
      borderColor: theme.colors.border,
    }]}>
    <X size={vision ? 26 : 22} color={theme.colors.text} />
    {vision ? <Text style={[styles.label, { color: theme.colors.text }]}>Close</Text> : null}
  </Pressable>;
}

export function ControlSwitch({ theme, ...props }: SwitchProps & { theme: AppTheme }) {
  const vision = useVisionControls();
  if (!vision) return <Switch {...props} />;
  return <Pressable accessibilityRole="switch" accessibilityLabel={props.accessibilityLabel}
    accessibilityState={{ checked: Boolean(props.value), disabled: Boolean(props.disabled) }}
    disabled={props.disabled} onPress={() => props.onValueChange?.(!props.value)}
    style={[styles.toggle, { opacity: props.disabled ? 0.45 : 1,
      borderColor: props.value ? theme.colors.accent : theme.colors.border,
      backgroundColor: props.value ? theme.colors.accentSoft : theme.colors.surfaceRaised }]}>
    <Text style={[styles.label, { color: theme.colors.text }]}>{props.value ? 'On' : 'Off'}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14 },
  visionClose: { width: 'auto', minWidth: 132, height: VISION_TARGET_SIZE, borderWidth: 1, paddingHorizontal: 16 },
  toggle: { minWidth: 96, minHeight: VISION_TARGET_SIZE, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 18, fontWeight: '600' },
});
