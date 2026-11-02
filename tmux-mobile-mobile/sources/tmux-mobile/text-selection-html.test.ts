import { describe, it, expect } from 'vitest';
import { textSelectionHtml } from './text-selection-html';
describe('text selection document', () => {
  it('treats agent HTML as text rather than executable markup', () => {
    const html=textSelectionHtml('</pre><script>alert(1)</script>&中文', '#fff', '#000');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;/pre&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;中文');
  });
  it('preserves the complete response and paragraph breaks', () => {
    const text=('中文 paragraph\n\n').repeat(10000)+'FINAL_MARKER';
    const html=textSelectionHtml(text, '#fff', '#000');
    expect(html).toContain(text);expect(html).toContain('FINAL_MARKER</pre>');
  });
  it('enables native word selection with clear light and dark highlights', () => {
    const light = textSelectionHtml('text', '#fdf6e3', '#586e75');
    const dark = textSelectionHtml('text', '#002b36', '#93a1a1', true, true);
    expect(light).toContain('-webkit-user-select:text');
    expect(light).toContain('-webkit-touch-callout:default');
    expect(light).toContain('::selection{background:#155c86;color:#fff}');
    expect(dark).toContain('::selection{background:#b58900;color:#002b36}');
    expect(dark).toContain('ui-monospace,Menlo,monospace');
  });
});
