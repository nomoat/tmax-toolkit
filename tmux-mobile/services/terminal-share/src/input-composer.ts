import { bindStreamingDictation } from '../../../public/streaming-asr.js';
import { dictationTerminalText } from './dictation-input';

// The share owns only the entry point, draft and terminal insertion. Capture,
// provider preferences and finalization are shared with the ordinary Terminal.
export function installInputComposer({ sessionId, writable, streamUrl, insert }: {
  sessionId?: string;
  writable: () => boolean;
  streamUrl: () => string;
  insert: (text: string) => boolean;
}) {
  const open = document.querySelector<HTMLButtonElement>('#input-open')!;
  const panel = document.querySelector<HTMLElement>('#dictation')!;
  const input = document.querySelector<HTMLTextAreaElement>('#dictation-input')!;
  const button = document.querySelector<HTMLButtonElement>('#dictation-toggle')!;
  const submit = document.querySelector<HTMLButtonElement>('#dictation-insert')!;
  const clear = document.querySelector<HTMLButtonElement>('#dictation-clear')!;
  const status = document.querySelector<HTMLElement>('#dictation-status')!;
  const draftKey = sessionId ? `tmax.share.draft.${sessionId}` : '';
  let expanded = false;
  try { if (draftKey) input.value = sessionStorage.getItem(draftKey) || ''; } catch {}
  function save() {
    if (!draftKey) return;
    try {
      if (input.value) sessionStorage.setItem(draftKey, input.value);
      else sessionStorage.removeItem(draftKey);
    } catch { /* Storage can be unavailable; keep the draft in this page. */ }
  }
  function setText(text: string) { input.value = text; save(); }
  const dictation = bindStreamingDictation({
    button, input, controls: [clear], submitButton: submit,
    getText: () => input.value, setText,
    setStatus: text => { status.textContent = text.replace(/\bor Send$/, 'or Insert'); },
    isBlocked: () => !expanded || !writable(),
    disableWhenBlocked: true,
    onActive: () => render(),
    getStreamUrl: streamUrl,
  });
  function render() {
    panel.hidden = !expanded;
    open.setAttribute('aria-expanded', String(expanded));
    open.title = expanded ? 'Close text and voice input' : 'Open text and voice input';
    input.readOnly = !writable() || dictation.active;
    submit.disabled = !writable() || (!dictation.active && !dictationTerminalText(input.value).trim());
    clear.disabled = dictation.active || !input.value;
    dictation.refresh();
  }
  function close() {
    expanded = false;
    dictation.cancel();
    save();
    render();
    open.focus();
  }
  open.addEventListener('click', () => {
    if (expanded) { close(); return; }
    expanded = true;
    render();
    if (writable()) input.focus();
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  input.addEventListener('input', () => { save(); render(); });
  clear.addEventListener('click', () => { setText(''); status.textContent = ''; render(); });
  submit.addEventListener('click', () => {
    if (!expanded || !writable()) return;
    void dictation.submit(async value => {
      if (!expanded || !writable()) return;
      const text = dictationTerminalText(value);
      if (!text.trim() || !insert(text)) return;
      setText('');
      status.textContent = 'Text inserted · Press Enter separately to submit';
    }).finally(render);
  });
  // Include edits made by an IME before a final input event on navigation.
  window.addEventListener('pagehide', save);
  render();
  return {
    refresh() {
      if (!writable()) dictation.cancel();
      render();
    },
  };
}
