import { ControlSwitch, useVisionControls } from "./interaction-controls";
import * as React from 'react';
import { AppState, Modal as NativeModal, Platform, StyleSheet, Text, View, type ModalProps } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { Gauge } from 'lucide-react-native';
import type { AppTheme } from '@/theme';
import { createFpsPreference } from './fps-preference';
import { frameWindow, sampleFrame, startJsFrameSampling } from './fps-sampling';

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const preference = createFpsPreference(AsyncStorage);
const useEnabled = () => React.useSyncExternalStore(preference.subscribe, preference.getSnapshot, () => false);
type Readings = { ui: number | null; js: number | null };
const empty: Readings = { ui: null, js: null };
let readings = empty;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => readings;
function publish(next: Readings) {
  if (readings.ui === next.ui && readings.js === next.js) return;
  readings = next; listeners.forEach(listener => listener());
}

// Exactly one sampler for the app. Only the small readouts subscribe to results;
// sampling never causes the card list, Terminal or other screen to render again.
function Sampler() {
  const alive = React.useRef(false);
  const window = useSharedValue(frameWindow());
  const reportUi = React.useCallback((fps: number) => {
    if (alive.current) publish({ ...readings, ui: fps });
  }, []);
  const callback = useFrameCallback(React.useCallback((info) => {
    'worklet';
    if (info.timeSincePreviousFrame === null) window.value = frameWindow();
    window.modify(current => {
      const fps = sampleFrame(current, info.timestamp);
      if (fps !== null) runOnJS(reportUi)(fps);
      return current;
    });
  }, [window, reportUi]), false);
  React.useEffect(() => {
    alive.current = true;
    publish(empty);
    callback.setActive(true);
    const stopJs = startJsFrameSampling(
      fps => { if (alive.current) publish({ ...readings, js: fps }); },
      requestAnimationFrame, cancelAnimationFrame,
    );
    return () => {
      alive.current = false;
      callback.setActive(false);
      stopJs();
      publish(empty);
    };
  }, [callback]);
  return null;
}

export function FpsMonitor() {
  const enabled = useEnabled();
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  React.useEffect(() => {
    if (!native) return;
    void preference.load();
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  if (!native) return null;
  return <>{enabled && active ? <Sampler /> : null}<FpsOverlay /></>;
}

function Readout() {
  const { ui, js } = React.useSyncExternalStore(subscribe, snapshot, () => empty);
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" accessible accessibilityLabel={`UI ${ui ?? 'measuring'} FPS, JS ${js ?? 'measuring'} FPS`}
    style={[styles.overlay, { top: insets.top + 62, right: insets.right + 8 }]}>
    <Text style={styles.value} maxFontSizeMultiplier={1.3}>UI {ui ?? '—'} FPS</Text>
    <Text style={styles.value} maxFontSizeMultiplier={1.3}>JS {js ?? '—'} FPS</Text>
  </View>;
}
export function FpsOverlay() {
  const enabled = useEnabled();
  return native && enabled ? <Readout /> : null;
}

// Native Modal creates a separate presentation surface on both platforms. Attach
// another readout there, sharing the one sampler, so it stays above every sheet.
export function FpsModal({ children, ...props }: ModalProps) {
  return <NativeModal {...props}>{children}<FpsOverlay /></NativeModal>;
}

export function FpsMenuToggle({ theme }: { theme: AppTheme }) {
  const vision = useVisionControls();
  const enabled = useEnabled();
  if (!native) return null;
  return <View style={[styles.menuRow, vision && { minHeight: 88, gap: 12 }]}>
    <Gauge size={18} color={theme.colors.text} />
    <View style={styles.menuLabel}>
      <Text style={{ color: theme.colors.text, fontSize: 15 }}>Show FPS</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>UI drawing · JS app logic</Text>
    </View>
    <ControlSwitch theme={theme} accessibilityLabel="Show FPS overlay" value={enabled}
      onValueChange={value => { void preference.setEnabled(value); }}
      trackColor={{ true: theme.colors.accent }} />
  </View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', zIndex: 10000, elevation: 10000, minWidth: 88, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#586e75', backgroundColor: '#002b36f2' },
  value: { color: '#fdf6e3', fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  menuLabel: { flex: 1, gap: 3 },
});
