import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import type { AppTheme } from '@/theme';
import { CARD_ACTION_LAYOUT, CARD_ACTION_ICONS, type CardIconId, type CardActionId } from './card-actions';
import { cardActionItems, type CardActionHandlers } from './card-action-state';
import type { AgentSession } from './types';
import { useVisionControls } from './interaction-controls';

const visionLabels: Record<CardActionId, string> = { interact: 'Send', conversation: 'Conversation', drafts: 'Drafts', transcript: 'Transcript', terminal: 'Terminal', share: 'Share', copyLink: 'Copy link', rename: 'Rename', delete: 'Complete & delete' };

const shapes = { circle: Circle, line: Line, path: Path, polyline: Polyline, rect: Rect };

export function CardActionIcon({ id, color, size = 18 }: { id: CardIconId; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {CARD_ACTION_ICONS[id].map(([tag, attrs], index) => {
      const Shape = shapes[tag as keyof typeof shapes];
      return <Shape key={index} {...attrs} />;
    })}
  </Svg>;
}

export function CardActionBar({ agent, handlers, theme }: {
  agent: AgentSession; handlers: CardActionHandlers; theme: AppTheme;
}) {
  const [hint, setHint] = React.useState<string | null>(null);
  const vision = useVisionControls();
  const items = cardActionItems(agent, handlers);
  const buttons = items.map(action => <Pressable
    key={action.id}
    testID={`card-action-${action.id}`}
    accessibilityRole="button"
    accessibilityLabel={action.label}
    accessibilityHint={action.hint}
    accessibilityState={{ disabled: action.disabled }}
    disabled={action.disabled}
    onPress={action.onPress}
    onLongPress={() => setHint(`${action.label} · ${action.hint}`)}
    onPressOut={() => setHint(null)}
    style={({ pressed }) => [vision ? styles.visionButton : styles.button, {
      borderRadius: theme.radii.md,
      borderColor: theme.colors.border,
      backgroundColor: pressed ? theme.colors.surfaceMuted : vision ? theme.colors.surface : 'transparent',
      opacity: action.disabled ? 0.45 : 1,
    }]}
  >
    <CardActionIcon id={action.icon} size={vision ? 26 : 18} color={theme.colors.textMuted} />
    {vision ? <Text style={[styles.visionLabel, { color: theme.colors.text }]}>{visionLabels[action.id]}</Text> : null}
  </Pressable>);
  return <View style={styles.bar} testID="card-actions">
    {hint ? <View pointerEvents="none" style={[styles.hint, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.text, fontSize: 12 }}>{hint}</Text>
    </View> : null}
    {vision ? <View style={styles.visionRow}>{buttons}</View> : <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}
      contentContainerStyle={styles.row} onScrollBeginDrag={() => setHint(null)}>
      {buttons}
    </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({
  bar: { width: '100%' },
  scroll: { height: CARD_ACTION_LAYOUT.height, flexGrow: 0 },
  row: { flexDirection: 'row', flexGrow: 1, gap: CARD_ACTION_LAYOUT.gap },
  button: { width: CARD_ACTION_LAYOUT.minWidth, flexGrow: 1, flexShrink: 0, height: CARD_ACTION_LAYOUT.height, alignItems: 'center', justifyContent: 'center' },
  visionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  visionButton: { flexGrow: 1, flexBasis: 120, minWidth: 112, minHeight: 96, padding: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  visionLabel: { fontSize: 16, lineHeight: 21, textAlign: 'center' },
  hint: { position: 'absolute', bottom: '100%', left: 0, right: 0, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, zIndex: 1 },
});
