import * as React from 'react';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebViewProps } from 'react-native-webview';

const native = vi.hoisted(() => ({ props: [] as WebViewProps[] }));
vi.mock('react-native-webview', () => ({
  WebView: (props: WebViewProps) => {
    // Android forwards this prop to a generated ReadableArray setter. Unlike
    // iOS, its adapter does not normalize the string allowed by public types.
    if (!Array.isArray(props.dataDetectorTypes)) {
      throw new TypeError('Android dataDetectorTypes requires ReadableArray');
    }
    native.props.push(props);
    return null;
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { create: (styles: unknown) => styles },
  Pressable: () => null,
  Text: () => null,
  View: () => null,
}));
vi.mock('./interaction-controls', () => ({ CloseButton: () => null, useVisionControls: () => false }));
vi.mock('./fps-monitor', () => ({ FpsModal: () => null }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

import { darkTheme, lightTheme } from '@/theme';
import { SelectableTextPage } from './text-selection';
const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (node: React.ReactNode) => string;
};

describe('selection page native prop contract', () => {
  beforeEach(() => { native.props.length = 0; });

  it.each([lightTheme, darkTheme])('opens one static line with Android-compatible props (dark=$dark)', theme => {
    expect(() => renderToStaticMarkup(React.createElement(SelectableTextPage, {
      text: 'SYNTHETIC <text> & 中文', theme,
    }))).not.toThrow();
    expect(native.props).toHaveLength(1);
    const props = native.props[0];
    expect(props.dataDetectorTypes).toEqual(['none']);
    expect(props.javaScriptEnabled).toBe(false);
    expect(props.source).toHaveProperty('html', expect.stringContaining('SYNTHETIC &lt;text&gt; &amp; 中文'));
    const request = { url: 'about:blank' } as Parameters<NonNullable<WebViewProps['onShouldStartLoadWithRequest']>>[0];
    expect(props.onShouldStartLoadWithRequest?.(request)).toBe(true);
    expect(props.onShouldStartLoadWithRequest?.({ ...request, url: 'https://example.com' })).toBe(false);
  });
});
