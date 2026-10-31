import { useVisionControls } from "./interaction-controls";
import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '@/theme';
import { ASR_OPTIONS, type AsrMode } from './asr-provider';
import { speechPreference } from './speech-preference';

export function SpeechSettings({ visible, theme }: { visible: boolean; theme: AppTheme }) {
  const vision = useVisionControls();
  const selected = React.useSyncExternalStore(speechPreference.subscribe, speechPreference.getSnapshot);
  const [ready, setReady] = React.useState(false), [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState(''), [failed, setFailed] = React.useState(false);
  const load = React.useCallback(async () => {
    try { await speechPreference.load(); setReady(true); setFailed(false); setMessage(''); }
    catch { setFailed(true); setMessage('Could not load speech settings. Please retry.'); }
  }, []);
  React.useEffect(() => { if (visible) void load(); }, [visible, load]);
  const save = async (mode: AsrMode) => {
    setSaving(true); setFailed(false);
    try { await speechPreference.setMode(mode); setMessage('Saved · Applies to the next recording'); }
    catch { setFailed(true); setMessage('Could not save. Your previous choice is still active. Please retry.'); }
    finally { setSaving(false); }
  };
  const c = theme.colors;
  return <View style={styles.section}>
    <Text style={[styles.title, { color: c.text }]}>Speech recognition</Text>
    <Text style={{ color: c.textMuted }}>Saved on this device. The recording status shows the service actually in use.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Speech recognition service" style={[styles.options, vision && { gap: 12 }]}>
      {ASR_OPTIONS.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityLabel={option.label} accessibilityState={{ checked: selected === option.value, disabled: !ready || saving }}
        disabled={!ready || saving} onPress={() => void save(option.value)}
        style={[styles.option, vision && { minHeight: 80, padding: 20 }, { borderColor: selected === option.value ? c.accent : c.border, opacity: !ready || saving ? 0.6 : 1 }]}>
        <Text style={[styles.radio, { color: selected === option.value ? c.accent : c.textMuted }]}>{selected === option.value ? '◉' : '○'}</Text>
        <View style={styles.label}><Text style={{ color: c.text, fontWeight: '600' }}>{option.label}</Text><Text style={{ color: c.textMuted }}>{option.description}</Text></View>
      </Pressable>)}
    </View>
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: failed ? c.danger : c.textMuted }}>{message}</Text> : null}
    {!ready && failed ? <Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.retry, vision && { minHeight: 64, justifyContent: "center" }]}><Text style={{ color: c.accent }}>Retry</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: 10, marginBottom: 24 }, title: { fontSize: 17, fontWeight: '600' },
  options: { gap: 8 }, option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 56, borderWidth: 1, borderRadius: 10 },
  radio: { fontSize: 22 }, label: { flex: 1, gap: 4 }, retry: { paddingVertical: 12 },
});
