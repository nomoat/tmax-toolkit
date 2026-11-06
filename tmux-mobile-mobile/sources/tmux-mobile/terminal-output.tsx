import * as React from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { parseAnsiLines, renderAnsiText, type AnsiLine } from "./ansi";

type Props = { text: string; style: StyleProp<TextStyle>; onLongPress: () => void };
const androidLineStyle: TextStyle = { includeFontPadding: false };

const TerminalLine = React.memo(function TerminalLine({ line, style, onLongPress }: {
  line: AnsiLine;
  style: StyleProp<TextStyle>;
  styleKey: string;
  onLongPress: () => void;
}) {
  return <Text style={[style, androidLineStyle]} onLongPress={onLongPress}>
    {line.runs.length ? line.runs.map((run, index) => run.style
      ? <Text key={index} style={run.style}>{run.text}</Text>
      : run.text) : "\u200B"}
  </Text>;
}, (previous, next) => previous.line.signature === next.line.signature
  && previous.styleKey === next.styleKey && previous.onLongPress === next.onLongPress);

export function TerminalOutput({ text, style, onLongPress }: Props) {
  const android = Platform.OS === "android";
  const output = text || "No output.";
  const lines = React.useMemo(() => android ? parseAnsiLines(output) : [], [android, output]);
  const nodes = React.useMemo(() => android ? [] : renderAnsiText(output), [android, output]);
  const latestLongPress = React.useRef(onLongPress);
  React.useLayoutEffect(() => { latestLongPress.current = onLongPress; }, [onLongPress]);
  const selectText = React.useCallback(() => latestLongPress.current(), []);
  const styleKey = JSON.stringify(StyleSheet.flatten(style));

  if (!android) return <Text accessibilityLabel="Terminal output"
    accessibilityHint="Long-press to open text selection" onLongPress={onLongPress} style={style}>{nodes}</Text>;

  return <View accessible accessibilityLabel="Terminal output" accessibilityHint="Long-press to open text selection"
    accessibilityActions={[{ name: "longpress", label: "Select terminal output" }]}
    onAccessibilityAction={event => { if (event.nativeEvent.actionName === "longpress") selectText(); }}>
    {lines.map((line, index) => <TerminalLine key={index} line={line} style={style} styleKey={styleKey} onLongPress={selectText} />)}
  </View>;
}
