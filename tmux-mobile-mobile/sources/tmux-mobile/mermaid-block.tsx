import * as React from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { WebView } from "react-native-webview";
import { mermaidHtml } from "./mermaid-html";

export function MermaidBlock({ source, textStyle }: { source: string; textStyle?: StyleProp<TextStyle> }) {
  const [rendered, setRendered] = React.useState(false);
  const [showSource, setShowSource] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState("");
  const [height, setHeight] = React.useState(260);
  const [active, setActive] = React.useState(AppState.currentState === "active");
  const html = React.useMemo(() => ({ html: mermaidHtml(source) }), [source]);
  React.useEffect(() => {
    const listener = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => listener.remove();
  }, []);
  React.useEffect(() => {
    setRendered(false); setReady(false); setShowSource(false); setError("");
  }, [source]);
  const fail = (message: string) => { setError(message); setRendered(false); setReady(false); };
  return (
    <View style={styles.block}>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
        if (!rendered) { setError(""); setReady(false); setShowSource(false); setRendered(true); }
        else setShowSource(value => !value);
      }}>
        <Text style={styles.buttonText}>{rendered ? (showSource ? "Show diagram" : "Show source") : "Render diagram"}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>Diagram unavailable: {error}</Text> : null}
      {!rendered || showSource ? <Text selectable style={textStyle}>{source}</Text> : null}
      {rendered && !showSource && active ? (
        <View>
          {!ready ? <ActivityIndicator accessibilityLabel="Rendering diagram" /> : null}
          <WebView
            source={html}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={request => request.url === "about:blank"}
            style={{ height, backgroundColor: "white" }}
            scrollEnabled
            nestedScrollEnabled
            setSupportMultipleWindows={false}
            onError={event => fail(event.nativeEvent.description)}
            onMessage={event => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                if (message.error) fail(String(message.error));
                else if (message.ready) {
                  if (Number.isFinite(message.height)) setHeight(Math.max(160, Math.min(700, message.height)));
                  setReady(true);
                }
              } catch { fail("Invalid diagram response"); }
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: "100%", marginVertical: 8 },
  button: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, backgroundColor: "#e9eef8", marginBottom: 8 },
  buttonText: { color: "#245ac4", fontWeight: "600" },
  error: { color: "#d44", marginBottom: 8 },
});
