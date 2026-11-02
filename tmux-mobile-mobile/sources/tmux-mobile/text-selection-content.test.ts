import { describe, expect, it } from 'vitest';
import { terminalSelectionText, transcriptSelectionText } from './text-selection-content';

describe('selection snapshots', () => {
  it('copies terminal text without colors, cursor controls or OSC links', () => {
    const text = '\x1b[31m中文\x1b[0m\t  indented\r\n\x1b]8;;https://example.com\x07link\x1b]8;;\x1b\\\x1b[2K\x07';
    expect(terminalSelectionText(text)).toBe('中文\t  indented\nlink');
  });
  it('keeps all captured lines and Unicode, without truncating or trimming', () => {
    const text = ('  中文 👋\n').repeat(10000) + '  LAST  ';
    expect(terminalSelectionText(text)).toBe(text);
  });
  it('preserves transcript order, roles, Markdown and paragraph boundaries', () => {
    const turns = [{ role: 'user', text: '问题\n\nnext' }, { role: 'assistant', text: '**answer**' }];
    const snapshot = transcriptSelectionText(turns);
    turns[1].text = 'new output';
    expect(snapshot).toBe('user\n问题\n\nnext\n\nassistant\n**answer**');
    expect(transcriptSelectionText([])).toBe('');
  });
});
