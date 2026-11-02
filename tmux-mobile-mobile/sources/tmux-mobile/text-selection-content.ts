/** Keep the complete captured output, but never copy terminal control sequences. */
export function terminalSelectionText(text: string): string {
  return text
    .replace(/\x1B\][\s\S]*?(?:\x07|\x1B\\)/g, '')
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1B[@-Z\\-_]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function transcriptSelectionText(turns: ReadonlyArray<{ role?: string; text?: string }>): string {
  return turns.map(turn => `${turn.role || 'turn'}\n${turn.text || ''}`).join('\n\n');
}
