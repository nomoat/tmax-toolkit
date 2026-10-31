import { CloseButton, useVisionControls } from "./interaction-controls";
import { ASR_PREFERENCE_KEY } from "./asr-provider";
import { speechPreference } from "./speech-preference";
import * as React from 'react';
import { NATIVE_VISION_CONTROLS_DETECTED } from './vision-device';
import { FpsModal as Modal } from './fps-monitor';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronLeft, RefreshCcw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/theme';
import type { TmuxMobileApi } from './api';
import { temporaryTerminalNavigationAllowed } from './temporary-terminal-navigation';
import { draftNavigationAllowed, validateDraftHandoff } from './drafts-navigation';

// Mounted only while open: closing also destroys the WebView and pending work.
export function DraftsModal({ api, initialPath, theme, onClose, page = 'drafts' }: {
  api: TmuxMobileApi;
  initialPath: string;
  page?: 'drafts' | 'terminal';
  theme: AppTheme;
  onClose: () => void;
}) {
  const speechMode = React.useSyncExternalStore(speechPreference.subscribe, speechPreference.getSnapshot);
  const vision = useVisionControls();
  const title = page === 'terminal' ? 'Temporary terminal' : 'Drafts';
  const insets = useSafeAreaInsets();
  const browser = React.useRef<WebView>(null);
  const [source, setSource] = React.useState<{ uri: string } | null>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [canGoBack, setCanGoBack] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setSource(null);
    setError('');
    setLoading(true);
    setCanGoBack(false);
    Promise.all([api.browserHandoff(initialPath), speechPreference.load()]).then(([handoff]) => {
      if (active) setSource({ uri: validateDraftHandoff(api.baseUrl, handoff.handoffUrl) });
    }).catch(reason => {
      if (active) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); }
    });
    return () => { active = false; };
  }, [api, initialPath, attempt]);
  const themeScript = `try { localStorage.setItem(${JSON.stringify(ASR_PREFERENCE_KEY)}, ${JSON.stringify(speechMode)}); localStorage.setItem('tmux-mobile-theme', JSON.stringify({theme:${JSON.stringify(theme.dark ? 'dark' : 'kami')}})); document.documentElement.dataset.theme=${JSON.stringify(theme.dark ? 'dark' : 'kami')}; } catch (_) {} true;`;
  React.useEffect(() => { browser.current?.injectJavaScript(themeScript); }, [themeScript]);
  const back = () => canGoBack ? browser.current?.goBack() : onClose();
  const control = (label: string, icon: React.ReactNode, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.control, vision && styles.visionControl, vision && { backgroundColor: theme.colors.surfaceRaised }]} hitSlop={vision ? 0 : 4}>{icon}</Pressable>
  );
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
      <View style={[styles.screen, { backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.header, vision && styles.visionHeader, { borderBottomColor: theme.colors.border }]}>
          {control('Back', <ChevronLeft size={vision ? 26 : 22} color={theme.colors.text} />, back)}
          <Text style={[styles.title, theme.typography.section, { color: theme.colors.text }]}>{title}</Text>
          {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          {control(`Refresh ${title.toLowerCase()}`,  <RefreshCcw size={vision ? 26 : 19} color={theme.colors.text} />, () => {
            if (error || !source) setAttempt(value => value + 1);
            else browser.current?.reload();
          })}
          <CloseButton accessibilityLabel={`Close ${title.toLowerCase()}`} theme={theme} onPress={onClose} />
        </View>
        {error ? (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={[styles.retry, vision && styles.visionControl]}>
              <Text style={{ color: theme.colors.accent }}>Try again</Text>
            </Pressable>
          </View>
        ) : source ? (
          <WebView
            ref={browser}
            source={source}
            applicationNameForUserAgent={NATIVE_VISION_CONTROLS_DETECTED ? "TMaxVision/1" : undefined}
            style={[styles.screen, { backgroundColor: theme.colors.background }]}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={request => {
              if (page !== 'terminal') return draftNavigationAllowed(api.baseUrl, request.url);
              try {
                const url = new URL(request.url);
                if (request.isTopFrame && url.origin === new URL(api.baseUrl).origin && ['/', '/command-center', '/app'].includes(url.pathname)) {
                  onClose(); return false;
                }
              } catch {}
              return temporaryTerminalNavigationAllowed(api.baseUrl, request.url);
            }}
            onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={event => { setError(event.nativeEvent.description); setLoading(false); }}
            onHttpError={event => {
              if (['/auth/browser-handoff', '/drafts', '/temporary-terminals'].includes(new URL(event.nativeEvent.url).pathname)) {
                setError(`Could not load ${title} (${event.nativeEvent.statusCode}). Try again.`);
                setLoading(false);
              }
            }}
            injectedJavaScriptBeforeContentLoaded={themeScript}
            injectedJavaScript={themeScript}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            onContentProcessDidTerminate={() => setAttempt(value => value + 1)}
          />
        ) : null}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, marginLeft: 4 },
  control: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  visionHeader: { gap: 12, paddingVertical: 12, flexWrap: 'wrap' },
  visionControl: { minWidth: 64, width: 64, height: 64, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  error: { padding: 24, gap: 16 },
  retry: { alignSelf: 'flex-start', paddingVertical: 12 },
});
