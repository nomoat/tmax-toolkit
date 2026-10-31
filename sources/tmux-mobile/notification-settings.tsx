import { ControlSwitch, useVisionControls } from "./interaction-controls";
import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import type { AppTheme } from "@/theme";
import { useTmuxMobileApi } from "./auth";

type Settings = { enabled: boolean; start: string; end: string; timeZone: string; updatedAt: number };
type Response = { settings: Settings; canEdit: boolean };

export function NotificationSettings({ visible, theme, InputComponent = TextInput }: { visible: boolean; theme: AppTheme; InputComponent?: React.ComponentType<TextInputProps> }) {
  const vision = useVisionControls();
  const api = useTmuxMobileApi();
  const [saved, setSaved] = React.useState<Settings | null>(null);
  const [draft, setDraft] = React.useState<Settings | null>(null);
  const [canEdit, setCanEdit] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const generation = React.useRef(0);
  const c = theme.colors;
  const styles = React.useMemo(() => StyleSheet.create({
    section: { gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
    title: { color: c.text, fontSize: 17, fontWeight: "600" },
    text: { color: c.text, fontSize: 14 },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    input: { color: c.text, backgroundColor: c.surfaceRaised, borderColor: c.border, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 46, marginTop: 6 },
    button: { minHeight: vision ? 64 : 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 10 },
    disabled: { opacity: 0.5 },
  }), [c, vision]);

  React.useEffect(() => {
    const current = ++generation.current;
    if (!visible || !api) return;
    setBusy(true); setMessage(""); setFailed(false); setDraft(null); setSaved(null);
    api.request<Response>("/api/notification-settings").then(data => {
      if (current !== generation.current) return;
      setSaved(data.settings);
      setDraft({ ...data.settings, timeZone: data.settings.updatedAt ? data.settings.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone });
      setCanEdit(data.canEdit);
    }).catch(error => {
      if (current !== generation.current) return;
      setMessage(error instanceof Error ? error.message : "Could not load notifications."); setFailed(true);
    }).finally(() => { if (current === generation.current) setBusy(false); });
    return () => { generation.current += 1; };
  }, [api, visible, retry]);

  const save = async () => {
    if (!api || !draft || !saved || busy || !canEdit) return;
    const current = generation.current;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const body = draft.enabled ? { ...draft, timeZone: draft.timeZone.trim() } : { ...saved, enabled: false };
      const data = await api.request<Response>("/api/notification-settings", { method: "PUT", body });
      if (current !== generation.current) return;
      setSaved(data.settings); setDraft(data.settings); setCanEdit(data.canEdit);
      setMessage("Saved. The server is using these settings now.");
    } catch (error) {
      if (current !== generation.current) return;
      setMessage(error instanceof Error ? error.message : "Could not save notifications."); setFailed(true);
    } finally { if (current === generation.current) setBusy(false); }
  };
  const editable = canEdit && !busy;
  return <View style={styles.section}>
    <Text style={styles.title}>Notifications</Text>
    <Text style={styles.hint}>Shared by all machines. The server follows this schedule even when the app is closed.</Text>
    {draft ? <>
      <View style={styles.row}>
        <Text style={styles.text}>Quiet hours</Text>
        <ControlSwitch theme={theme} accessibilityLabel="Quiet hours" value={draft.enabled} disabled={!editable} onValueChange={enabled => setDraft({ ...draft, enabled })} trackColor={{ true: c.accent }} />
      </View>
      <Text style={styles.hint}>Off means notifications can arrive at any time. Muted messages are not sent later.</Text>
      {draft.enabled ? <>
        <View style={[styles.row, vision && { flexDirection: "column", alignItems: "stretch" }]}>
          {([['start', 'From'], ['end', 'Until']] as const).map(([key, label]) => <View key={key} style={{ flex: 1 }}>
            <Text style={styles.text}>{label} (24h)</Text>
            <InputComponent accessibilityLabel={label} style={styles.input} value={draft[key]} editable={editable} autoCorrect={false} autoCapitalize="none" placeholder="HH:mm" placeholderTextColor={c.textMuted} maxLength={5} onChangeText={value => setDraft({ ...draft, [key]: value })} />
          </View>)}
        </View>
        <View><Text style={styles.text}>Timezone</Text><InputComponent accessibilityLabel="Timezone" style={styles.input} value={draft.timeZone} editable={editable} autoCorrect={false} autoCapitalize="none" onChangeText={timeZone => setDraft({ ...draft, timeZone })} /></View>
        {canEdit ? <Pressable accessibilityRole="button" style={styles.button} disabled={busy} onPress={() => setDraft({ ...draft, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}><Text style={styles.text}>Use device timezone</Text></Pressable> : null}
      </> : null}
      {canEdit ? <Pressable accessibilityRole="button" style={[styles.button, busy && styles.disabled]} disabled={busy} onPress={() => void save()}><Text style={styles.text}>Save notifications</Text></Pressable> : <Text style={styles.hint}>Only an administrator can change these shared settings.</Text>}
    </> : null}
    {busy ? <ActivityIndicator color={c.accent} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={[styles.hint, failed && { color: c.danger }]}>{message}</Text> : null}
    {!draft && !busy ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => setRetry(value => value + 1)}><Text style={styles.text}>Retry</Text></Pressable> : null}
  </View>;
}
