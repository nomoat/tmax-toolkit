import { useVisionControls } from "./interaction-controls";
import * as React from 'react';
import { FpsModal as Modal } from './fps-monitor';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/theme';

type Request = { title: string; message: string; buttons: AlertButton[] };
// Each owner renders its dialog inside its own sheet, so confirmations also work
// above iOS native modals (SSH, saved files), rather than behind them.
export function useAppDialog(theme: AppTheme, enabled = true) {
  const vision = useVisionControls();
  const insets = useSafeAreaInsets();
  const available = React.useRef(enabled);
  available.current = enabled;
  const mounted = React.useRef(true);
  const [request, setRequest] = React.useState<Request | null>(null);
  const current = React.useRef<Request | null>(null);
  const afterDismiss = React.useRef<(() => void) | undefined>(undefined);
  const flush = React.useCallback(() => {
    const action = afterDismiss.current; afterDismiss.current = undefined; action?.();
  }, []);
  const show = React.useCallback((title: string, message = '', buttons: AlertButton[] = [{ text: 'OK' }]) => {
    if (!mounted.current || !available.current || current.current) return;
    const next = { title, message, buttons };
    current.current = next; setRequest(next);
  }, []);
  const finish = React.useCallback((button?: AlertButton) => {
    if (!current.current) return;
    current.current = null; afterDismiss.current = button?.onPress; setRequest(null);
    if (Platform.OS !== 'ios') flush();
  }, [flush]);
  const cancel = React.useCallback(() => finish(current.current?.buttons.find(button => button.style === 'cancel')), [finish]);
  React.useEffect(() => { if (!enabled) cancel(); }, [enabled, cancel]);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const pending = current.current; current.current = null;
      pending?.buttons.find(button => button.style === 'cancel')?.onPress?.();
    };
  }, []);
  const node = (
    <Modal visible={Boolean(request) && enabled} transparent animationType="fade" onRequestClose={cancel} onDismiss={flush}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable accessibilityLabel="Dismiss dialog" style={StyleSheet.absoluteFill} onPress={cancel} />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={[theme.typography.section, { color: theme.colors.text }]}>{request?.title}</Text>
            {request?.message ? <Text selectable style={[theme.typography.body, { color: theme.colors.textMuted }]}>{request.message}</Text> : null}
            <View style={styles.actions}>
              {request?.buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" onPress={() => finish(button)}
                style={[styles.button, vision && { minHeight: 64, minWidth: 112 }, { borderColor: theme.colors.border, backgroundColor: button.style === 'destructive' ? theme.colors.danger : theme.colors.surfaceRaised }]}>
                <Text style={[theme.typography.body, { color: button.style === 'destructive' ? '#ffffff' : theme.colors.text }]}>{button.text || 'OK'}</Text>
              </Pressable>)}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  return { show, node, visible: Boolean(request), dismiss: cancel };
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#002b3680' },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '100%', borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  content: { padding: 22, gap: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  button: { minHeight: 44, minWidth: 90, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
});
