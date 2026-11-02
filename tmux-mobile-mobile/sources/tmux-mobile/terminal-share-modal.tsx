import { CloseButton, ControlSwitch, useVisionControls } from "./interaction-controls";
import * as React from 'react';
import { FpsModal as Modal } from './fps-monitor';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/theme';
import type { TmuxMobileApi } from './api';
import type { AgentSession } from './types';
import { SHARE_DURATIONS, terminalShareUrl, type TerminalShareAction, type TerminalShareState } from './terminal-share';

// The parent captures the target when opened; list refreshes never replace it.
export function TerminalShareModal({ api, target, theme, onClose }: {
  api: TmuxMobileApi; target: AgentSession; theme: AppTheme; onClose: () => void;
}) {
  const vision = useVisionControls();
  const insets = useSafeAreaInsets();
  const [share, setShare] = React.useState<TerminalShareState>({});
  const [ttl, setTtl] = React.useState<number>(86400);
  const [allowControl, setAllowControl] = React.useState(true);
  const [busy, setBusy] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const mounted = React.useRef(false);
  const generation = React.useRef(0);
  const pending = React.useRef(false);
  const url = terminalShareUrl(share);
  const apply = React.useCallback((value: TerminalShareState) => {
    terminalShareUrl(value); // Validate before making any URL actionable.
    setShare(value); setReady(true);
    if (value.viewerUrl) { setTtl(value.ttlSeconds || 86400); setAllowControl(Boolean(value.allowControl)); }
    else { setTtl(current => SHARE_DURATIONS.some(item => item.seconds === current) ? current : 86400); setAllowControl(true); }
  }, []);
  React.useEffect(() => {
    mounted.current = true;
    const current = ++generation.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    api.terminalShare(target, 'status', 86400, false, controller.signal)
      .then(value => { if (mounted.current && current === generation.current) apply(value); })
      .catch(reason => { if (mounted.current && current === generation.current) setError(reason.message); })
      .finally(() => { clearTimeout(timeout); if (mounted.current && current === generation.current) setBusy(false); });
    return () => { mounted.current = false; controller.abort(); clearTimeout(timeout); };
  }, [api, target, apply]);
  const run = async (action: TerminalShareAction) => {
    if (busy || pending.current) return;
    const current = generation.current;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const value = await api.terminalShare(target, action, action === 'start' ? ttl : 86400, allowControl);
      if (mounted.current && current === generation.current) apply(value);
    } catch (reason) {
      if (mounted.current && current === generation.current) setError(reason instanceof Error ? reason.message : String(reason));
    } finally { pending.current = false; if (mounted.current && current === generation.current) setBusy(false); }
  };
  const handleLink = async (action: 'copy' | 'open' | 'share') => {
    if (!url) return;
    try {
      if (action === 'copy') { await Clipboard.setStringAsync(url); if (mounted.current) setNotice('Link copied.'); }
      else if (action === 'open') await Linking.openURL(url);
      else await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const button = (label: string, onPress: () => void, disabled = busy, danger = false) => (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={[styles.button, vision && styles.visionButton, { borderColor: theme.colors.border, opacity: disabled ? 0.45 : 1 }]}>
      <Text style={[theme.typography.body, { color: danger ? theme.colors.danger : theme.colors.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={[styles.header, vision && { padding: 16, gap: 12 }]}>
            <Text style={[styles.title, theme.typography.section, { color: theme.colors.text }]}>Share terminal</Text>
            <CloseButton accessibilityLabel="Close terminal sharing" theme={theme} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[theme.typography.meta, { color: theme.colors.textMuted }]}>{target.machineHostname || target.machineId} · {target.windowName || target.sessionName || target.windowId || target.paneId}</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text }]}>Anyone with the link can view this terminal. You can stop sharing at any time.</Text>
            <Text style={[theme.typography.section, { color: theme.colors.text }]}>Expires after</Text>
            <View style={styles.actions}>
              {SHARE_DURATIONS.map(item => <Pressable key={item.seconds} accessibilityRole="radio" accessibilityLabel={item.label}
                accessibilityState={{ checked: ttl === item.seconds, disabled: busy || Boolean(url) }} disabled={busy || Boolean(url)} onPress={() => setTtl(item.seconds)}
                style={[styles.button, vision && styles.visionButton, { borderColor: ttl === item.seconds ? theme.colors.accent : theme.colors.border, backgroundColor: ttl === item.seconds ? theme.colors.surfaceRaised : theme.colors.surface }]}>
                <Text style={[theme.typography.body, { color: theme.colors.text }]}>{item.label}</Text>
              </Pressable>)}
            </View>
            <View style={styles.permission}>
              <Text style={[styles.title, theme.typography.body, { color: theme.colors.text }]}>Allow viewers to type and run commands</Text>
              <ControlSwitch theme={theme} accessibilityLabel="Allow viewers to type and run commands" value={allowControl} onValueChange={setAllowControl} disabled={busy || Boolean(url)} trackColor={{ true: theme.colors.accent }} />
            </View>
            {busy ? <ActivityIndicator accessibilityLabel="Updating terminal sharing" color={theme.colors.accent} /> : null}
            {error ? <Text accessibilityRole="alert" style={[theme.typography.body, { color: theme.colors.danger }]}>{error}</Text> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={[theme.typography.body, { color: theme.colors.text }]}>{notice}</Text> : null}
            {url ? <>
              <Text style={[theme.typography.body, { color: theme.colors.text }]}>{allowControl ? 'Viewers can request control.' : 'View only.'} Expires {new Date(share.expiresAt!).toLocaleString()}.</Text>
              <Text selectable numberOfLines={3} style={[styles.link, theme.typography.mono, { color: theme.colors.text, backgroundColor: theme.colors.surfaceRaised }]}>{url}</Text>
              <View style={styles.actions}>{button('Copy link', () => void handleLink('copy'))}{button('Share link', () => void handleLink('share'))}{button('Open link', () => void handleLink('open'))}</View>
              {button('Stop sharing', () => void run('stop'), busy, true)}
            </> : button(ready ? 'Create link' : 'Retry', () => void run(ready ? 'start' : 'status'))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, paddingTop: 8 },
  title: { flex: 1 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 16 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  visionButton: { minHeight: 64, minWidth: 96, paddingHorizontal: 20 },
  permission: { flexDirection: 'row', gap: 12, alignItems: 'center' }, link: { borderRadius: 8, padding: 12 },
});
