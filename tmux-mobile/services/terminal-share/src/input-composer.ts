import { bindStreamingDictation } from '../../../public/streaming-asr.js';
import { dictationTerminalText } from './dictation-input';

// The share owns only the entry point, draft and terminal insertion. Capture,
// provider preferences and finalization are shared with the ordinary Terminal.
export function installInputComposer({ sessionId, writable, streamUrl, insert, shortcutsAllowed = () => true }: {
  sessionId?: string;
  writable: () => boolean;
  streamUrl: () => string;
  insert: (text: string, sendEnter: boolean) => boolean;
  shortcutsAllowed?: () => boolean;
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
  let composing = false;
  open.setAttribute('aria-keyshortcuts', 'Alt+Shift+X');
  button.setAttribute('aria-keyshortcuts', 'Alt+Shift+R');
  input.setAttribute('aria-keyshortcuts', 'Alt+Shift+Enter');
  submit.title = 'Insert text only. Alt + Shift + Enter: insert and send Enter';
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
    shortcutHint: 'Alt + Shift + R',
    onActive: () => render(),
    getStreamUrl: streamUrl,
  });
  function render() {
    panel.hidden = !expanded;
    open.setAttribute('aria-expanded', String(expanded));
    open.title = `${expanded ? 'Close' : 'Open'} text and voice input (Alt + Shift + X to focus)`;
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
  function show() {
    expanded = true;
    render();
    if (writable()) input.focus();
  }
  open.addEventListener('click', () => {
    if (expanded) { close(); return; }
    show();
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || composing || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  input.addEventListener('input', () => { save(); render(); });
  clear.addEventListener('click', () => { setText(''); status.textContent = ''; render(); });
  function insertDraft(sendEnter = false) {
    if (!expanded || !writable()) return;
    void dictation.submit(async value => {
      if (!expanded || !writable() || !shortcutsAllowed()) return;
      const text = dictationTerminalText(value);
      if (!text.trim() || !insert(text, sendEnter)) return;
      setText('');
      status.textContent = sendEnter ? 'Text sent with Enter' : 'Text inserted · Press Enter separately to submit';
    }).finally(render);
  }
  submit.addEventListener('click', () => insertDraft());
  document.addEventListener('compositionstart', () => { composing = true; }, true);
  document.addEventListener('compositionend', () => { composing = false; }, true);
  document.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229 || !shortcutsAllowed() ||
      !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
    const key = event.code || event.key;
    if (!['KeyX', 'KeyR', 'Enter', 'NumpadEnter'].includes(key)) return;
    // Capture before xterm. Repeated keydowns must neither send again nor leak
    // their Enter into the terminal. Unmodified keys retain their usual meaning.
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (key === 'KeyX') show();
    else if (key === 'KeyR') { show(); button.click(); }
    else insertDraft(true);
  }, true);
  // Include edits made by an IME before a final input event on navigation.
  window.addEventListener('pagehide', () => { composing = false; save(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) composing = false;
  });
  render();
  return {
    refresh() {
      if (!writable()) dictation.cancel();
      render();
    },
  };
}
