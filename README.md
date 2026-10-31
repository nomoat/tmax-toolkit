# T-MAX

React Native Command Center client for tmux-mobile.

This app is a client only. It authenticates against a tmux-mobile controller
with the existing Google device-login flow, stores the returned browser session
token in SecureStore, and calls the same HTTPS API used by the web Command
Center.

## Scope

First screen:

- Machine filter
- Agent session cards
- Start Codex/Claude in a machine directory
- Send text to a pane
- Rename tmux/rmux window
- View pane tail
- View structured transcript

The older browser main app/window-driver UI is intentionally not ported yet.

## Development

```bash
yarn install
yarn dev
yarn ios
yarn typecheck
```

The default controller is `https://eng.xyznot.com`. Override it at build time with:

```bash
TMUX_MOBILE_CONTROLLER_URL=https://example.com yarn dev
```

## Terminal share links (2026-10-19)

The share action on tmux cards and in Terminal opens the same sharing controls
on iOS and Android: 10 minutes, 24 hours, 5 days or 7 days; 24 hours and viewer control by default; copy, system share, open and stop. The link uses our
Cloudflare viewer at share.xyznot.com. The authenticated Controller creates it
for the captured machine/pane; no terminal relay runs in the mobile app.

This is a JavaScript-only change. Publish production OTA to runtime 7 for
both platforms, and backport to runtime 6 Android using its own checkout and
lockfile. Existing RMUX sharing remains in the Web client.

## Temporary authentication terminals (2026-10-20)

More → Temporary terminal opens the authenticated Controller page inside the app,
with the current machine filter selected. Create a bare login shell, share for ten
minutes, extend, stop, reopen or explicitly close it. Expiry stops sharing only.
The Controller owns the shell lifecycle; the app does not run a second relay or
polling loop. Only same-controller pages and signed share.xyznot.com viewer links
are allowed inside this view. iOS waits for the menu to dismiss before presenting
it. App confirmation/error dialogs use the theme and preserve explicit destructive
and cancel actions, including SSH trust decisions.

Publish runtime 7 iOS/Android OTA and the runtime 6 Android backport from its own
checkout/lockfile. This change adds no native module and requires no binary build.

## Shared card actions (2026-10-22)

Web, iOS and Android use one compact 32px-high row of ten icons:
Send message, Conversation, Drafts, Transcript, Read aloud, Open terminal,
Share terminal, Copy conversation link, Rename window, Complete and delete window.
All ten buttons fit in 240px; narrower cards scroll horizontally and never wrap.
Unavailable actions keep their disabled slots. Long-press an icon for its name
and explanation. `sources/tmux-mobile/card-actions.js` is an exact bundled copy of
the Web repository's `public/card-actions.js`; do not edit the copy by hand.

Run `node scripts/sync-card-actions.mjs --source ../tmux-mobile/public/card-actions.js`
to update it, then typecheck and test. Publish Web before production OTA;
`scripts/ota-update.sh` checks the hosted contract before publishing. A direct
EAS update must first pass `node scripts/sync-card-actions.mjs --check --deployed
https://eng.xyznot.com` too. This reads the public health revision and uses `gh`
to compare its exact committed source, without copying browser credentials.
Ship both runtime 7 platforms and the
existing runtime 6 Android backport from its own unchanged dependencies.

## Selecting native text (2026-10-23)

Long-press native Terminal output, a Transcript message or a full response to
open a stable selection page inside the same sheet. The Select text button is
also available; Transcript's button includes every loaded turn. Long-press a
word there and drag the native selection handles, or use Copy all. Done returns
to the original reading position. Terminal polling pauses during selection;
copying removes ANSI controls and keeps all captured lines. Light and dark
selection colors remain readable. Ship this JavaScript-only change to runtime 7
iOS/Android and runtime 6 Android from its own checkout and dependencies.

## Session picker and temporary uploads (2026-10-27)

The lower-right floating List button opens the same session picker as the header.
It lists the current cards by most recent activity, shows relative times and jumps
to the chosen card. Start agent remains available in More.

File attachments stream from disk directly to S3 using a Controller-issued
30-minute upload URL. After completion, the composer receives a download link
that expires two hours after upload. Neither the Controller nor the Connector
relays file bytes. The old upload endpoint is retained only for local/older
Controllers; native fallback also avoids Base64 buffering. No native dependency
change is needed: ship runtime 7 iOS/Android and the runtime 6 Android backport.

## Live dictation (2026-10-27)

The waveform button in Send and Terminal composers uses Free ASR to show words
while speaking. Stop finalizes the transcript; Send remains separate. Existing
text is preserved, other editing controls lock during capture, and session changes,
backgrounding or closing cancel recording. The old complete-recording microphone button is hidden. Start/Cancel/Stop/Wait labels match Web. Stop closes the microphone before final text arrives. Vision Pro uses the same compact toggle and standard fields; the old mode chooser and settings entry are removed, and saved mode preferences no longer change the layout.

iOS and Android keep the screen awake while connecting and recording in either
composer. Stop, Cancel, errors, session changes, backgrounding and closing restore
normal auto-lock. Each capture owns a separate lock; cancellation during native
activation releases it once activation settles. This uses Expo KeepAwake already
included by Expo in both runtime binaries, with no native dependency changes.

Use the existing Expo AudioStream when the binary exposes it. Older binaries
stream new bytes from one AAC ADTS/WAV recording through the Controller decoder.
No native dependency changes are needed. Ship runtime 7 iOS/Android and runtime 6
Android independently. `streaming-asr-session.js` matches the Web source at
`tmux-mobile/public/streaming-asr-session.js`; keep both copies synchronized.

## App FPS monitor (2026-10-27)

More → Show FPS toggles a small, touch-through readout in iOS and Android,
including Terminal, Transcript, Drafts and other native sheets. It defaults off
and remembers the local preference. UI FPS samples Reanimated's UI-thread frame
callbacks; JS FPS samples JavaScript requestAnimationFrame. Values cover roughly
one second and support variable refresh rates; long stalls are included. These
are thread callback rates, not GPU presentation counts or a WebView's internal
JavaScript frame rate. A blocked JS thread can delay the displayed update.

There is one sampler regardless of how many sheets are open. Only the readouts
subscribe to measurements; screens do not re-render for each sample. Turning the
monitor off or leaving the foreground cancels both loops. Resuming starts a fresh
sample, excluding background time. No telemetry is stored or transmitted. The
browser UI is unchanged. This uses the Reanimated module already in both binaries;
publish runtime 7 iOS/Android OTA and the runtime 6 Android backport from its own
lockfile, without native dependency changes.
