# Live dictation

The waveform button streams speech into the composer.
The button says Start when idle, Cancel while connecting, and a red Stop while recording. Press Stop to turn off the microphone immediately. Wait indicates finalization with the microphone off.
The final result replaces the interim text. The original draft stays before the
new dictation. Send remains a separate action. The old complete-recording microphone button is hidden. Keyboard dictation shortcuts use the same streaming toggle.

The input and send/edit controls are locked during capture and finalization.
Errors retain the latest text. Vision Pro uses the same compact controls and text fields as the other native clients; old Vision-only preferences are ignored and its chooser/settings entry are removed. Closing the composer, switching sessions, leaving
the page or backgrounding the mobile app stops capture and cancels the stream.
Late results must never modify another session's draft.

## Transport

The Controller hosts authenticated WebSocket `/api/asr/stream`. Browsers use the
existing session cookie and an exact same-origin check; native uses the existing
Bearer header. No token goes in a URL. This endpoint never sends a terminal
command or Agent message. The client sends `{type:"start", format:"pcm16"}`,
waits for `{type:"ready"}`, then sends binary audio chunks. Supported formats are
16 kHz mono signed little-endian PCM, WAV and AAC ADTS. `{type:"finish"}` flushes
audio and waits for final text; `{type:"cancel"}` discards the active stream.
Responses are `transcript` (`text`, `final`), `done`, or `error` (`message`).

The Controller's automatic mode tries Doubao, then WeChat Input Method
(WeType), then the official Gemini Live Transcription API when the server has a
Gemini key. Each provider is attempted at most once per recording. The
`providerMode` values `doubao`, `wetype`, and `gemini` select only that provider;
`auto` uses the fallback chain. The legacy `provider:"wetype"` request still
prefers WeChat before Doubao, with configured Gemini last.

Connection errors, disconnects and final-response timeouts trigger the next
provider. The Controller retains at most 20 MiB of PCM in memory for replay,
then releases it on completion/cancellation. Backup partials replace the current
dictation only after catching up in length; the final corrected text replaces
it. Exhaustion returns an error and preserves the latest draft. End-to-end
finalization is bounded, including replay; unusually slow replay can time out.

Gemini uses `gemini-3.5-transcribe-live` over the official BidiGenerateContent
WebSocket. A recording is one manual activity: `activityStart`, continuous
16 kHz PCM, then `activityEnd`. Interim hypotheses replace the preview;
authoritative `inputTranscription` commits text. The final transcript after
manual activity end completes the recording. No fixed observation delay or
conversational `turnComplete` is used as success. Missing final text fails on a
bounded deadline and keeps the draft. See the [official transcription guide](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe)
and [WebSocket reference](https://ai.google.dev/api/live).

Gemini's key stays on the Controller. Local configuration uses `GEMINI_API_KEY`;
production reuses `loadReportConfig` and the encrypted report configuration in
private artifact storage (with the legacy transcript-storage fallback), decrypted with
`SESSION_SECRET`. See [Progress reports](progress-reports.md). Loading the key
for ASR does not alter the report model or scheduler. The key is sent only in
the Google socket's server-side header, never to a browser or share URL. A
header is supported by the [official Python Live client](https://github.com/googleapis/python-genai/blob/main/google/genai/live.py),
which inherits `x-goog-api-key` from its API client configuration. A
missing/invalid report config leaves automatic mode on the original two
providers; explicit Gemini reports that it is not configured.

WeType uses OpenSSL-backed Node crypto for ECDH/AES and the existing FFmpeg
installation (`libopus`, 20 ms frames) for live PCM-to-Opus encoding. It works on
Linux and macOS; no Apple audio tools are used on the Controller. Anonymous
WeType identity/key state is cached in process memory and refreshed on expiry.
Device codes are stable per user, derived from the existing HMAC device ID.
Neither provider's identifiers are rotated to evade limits. Audio and text are
never written to disk or logs. These reverse-engineered consumer interfaces can
change independently.

Web uses an AudioWorklet and continuous resampling. Current native binaries use
Expo AudioStream directly, with conversion from the actual hardware sample rate.
Older binaries use the existing Expo recorder and read only new file bytes every
150 ms: WAV PCM on iOS and streaming AAC ADTS on Android. They keep one continuous
recording and one recognition session. Temporary recording files are deleted
when capture ends. MP4 recordings are unsuitable here because their required
metadata may only become available after stopping.

The Controller image includes FFmpeg to decode WAV/AAC streams to PCM. Inputs
are fixed formats on stdin; the decoder can use only the pipe protocol, and
output is mono 16 kHz PCM. Limits are 64 KiB per frame, 20 MiB audio, ten minutes,
30 seconds without audio, 25 seconds to connect and 60 seconds to finalize
(client: 30/65 seconds), two streams per user and 16 streams per Controller process. Client/provider queues are bounded.
Disconnects terminate both the provider socket and decoder process.

The shared terminal viewer also uses this recorder through its same-origin
share-scoped ASR relay. Its toolbar **Input** button opens the existing draft
without starting capture; tap it again (or Escape in the draft) to close and
cancel recording. Drafts survive reload/navigation within the tab, keyed by
shared session. It requires active terminal control. Transcription stays
in a local draft until Insert; Enter is separate. The Worker sends a short-lived
service assertion only to the Controller, retaining the owner's stable ASR identity
and limits. Main-app browser cookies and native Bearer authentication are unchanged.

No Connector protocol or native module changed. Gemini support requires the
Controller/Web update and a rebuilt Shared Terminal viewer. Native JavaScript
needs the synchronized provider list and longer deadlines; no new native audio
module is required. Run `node ../tmux-mobile-mobile/scripts/sync-asr.mjs --check`
to verify the canonical Web copies.

Earlier streaming-recorder rollout: publish Web before runtime 7
(iOS/Android) and the runtime 6 Android OTA, using each runtime's own dependencies.
Tests: `node test/asr-failover.mjs`, `node test/streaming-asr.mjs`, native `streaming-asr.test.ts`, full suites,
and synthetic live PCM/WAV/AAC plus actual browser-button canaries. A microphone
must never be activated automatically for a test; use synthetic audio instead.

Live provider/failover canary (synthetic audio only):
`node test/asr-live.mjs /path/to/synthetic-16k-mono.pcm`.
The fixture sentence is documented in that script. It tests both services,
startup failure and forced midstream socket failures in both directions.
The earlier two-provider failover was a Controller-only change. Gemini adds a
provider option and longer client deadlines, so it needs the client updates
described above.

Shared Terminal keyboard controls (also listed on existing button titles/ARIA):

- **Alt + Shift + X** opens/focuses the draft from the terminal.
- **Alt + Shift + R** opens the draft and starts/stops recording; while connecting,
  it cancels. Stop never inserts or executes anything.
- **Alt + Shift + Enter** inserts the final draft and sends Enter once. If speech
  is active, it stops capture and waits for the final transcript first.
- **Escape** inside the draft closes it and cancels pending recording/submission.

The existing Insert button remains text-only; the existing Enter button is
unchanged. Composition/IME events and repeat keydowns do not trigger these
shortcuts. Read-only/control loss, backgrounding, closing the draft and leaving
the page cancel pending sends. Settings/text-selection dialogs retain their own
keyboard handling. Ctrl + Shift + Enter continues to lock/unlock input.

Gemini checks: `node test/gemini-asr.mjs`, `node test/gemini-asr-config.mjs`,
`node test/progress-reports.mjs`. The opt-in synthetic-speech canary is
`node test/gemini-asr-live.mjs /private/synthetic.pcm [--fallback]`. It can also
be imported server-side and given `loadReportConfig`'s key in memory. Never
pass a key on the command line. This test asserts live interim text before
all audio is sent and completion on a final event, not after a fixed sleep.
