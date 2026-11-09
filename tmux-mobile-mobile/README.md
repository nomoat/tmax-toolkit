# T-MAX

React Native Command Center client for tmux-mobile.

Drafts uses a compact native navigation row and a responsive hosted reader
toolbar for phones and short windows. Loading stays inside the Refresh button
without adding another slot; Vision controls retain their 64-point targets.
The hosted Drafts UI must be deployed alongside the JavaScript-only navigation
update for runtime 7 iOS/Android and runtime 6 Android.

This app is a client only. It authenticates against a tmux-mobile controller
with the existing Google device-login flow, stores the returned browser session
token in SecureStore, and calls the same HTTPS API used by the web Command
Center.

## Scope

First screen:

- Machine filter
- Agent session cards
- Start Codex/Claude/Pi in a machine directory
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

## Native iOS releases

The checked-in `ios` project is maintained by hand. Xcode 27 builds require
the scene lifecycle on iOS 27: keep `AppDelegate` conforming to
`ExpoReactNativeFactoryProvider` and the Info.plist scene manifest pointing to
`EXExpoAppSceneDelegate`. Expo 57.0.23 or newer supplies that delegate and starts
React Native from the scene; do not also start it from `AppDelegate`.
See the [Expo migration guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md#staying-on-sdk-57-with-xcode-27).

Runtime 7 requires a new native build (Expo 57.0.25 / React Native 0.86.3).
Do not publish its JavaScript as an OTA for older runtime 6 binaries.

## Paper style (2026-09-27)

The Web and native clients share Instant’s warm paper / forest / orange visual
language. `sources/theme.ts` owns native light/dark colors, rounded paper
surfaces and serif display titles. Existing explicit theme preferences persist;
a fresh install starts with the OS appearance. `logo.png` is the opaque app
icon; `logo-mark.png` is the transparent adaptive/splash mark. iOS asset catalogs
must be updated with the icon because this project is maintained by hand.

Runtime 6 Android receives the styling-only backport on
`release/paper-style-runtime6`, built from its existing lockfile. Runtime 7
gets the new native APK/TestFlight icon and splash screen. Do not relabel
runtime 7 JavaScript as runtime 6.

## Solarized palette (2026-10-19)

Web, iOS and Android now share Solarized Light/Dark colors. Native tokens live
in `sources/theme.ts`; layout, typography and saved Auto/Light/Dark preferences
are preserved. These JavaScript color changes ship through production OTA for
runtime 7 (iOS/Android) and the existing runtime 6 Android backport.

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

Web, iOS and Android use one compact 32px-high row of nine icons:
Send message, Conversation, Drafts, Transcript, Open terminal,
Share terminal, Copy conversation link, Rename window, Complete and delete window.
All nine buttons fit in 216px; narrower cards scroll horizontally and never wrap.
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

The shared selection WebView passes `dataDetectorTypes` as `['none']`. Android's
Fabric native setter requires an array even though the public WebView type also
accepts a string; iOS already normalizes strings to arrays. A string can fail
when opening selection for even one static line. This JavaScript-only fix ships
to Android runtime 7 and runtime 6 without a native build.

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
`tmux-mobile/public/streaming-asr-session.js`. Run `node scripts/sync-asr.mjs`
from this component to generate both ASR transport and provider preferences
from Web, then `node scripts/sync-asr.mjs --check` to verify parity. Gemini uses
the existing server-side key; the client only sends a provider mode. Publish
the synchronized JavaScript to expose Gemini and allow the full third-provider
finalization deadline. No native module change is required.

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

## Large Vision Pro controls (2026-10-31)

Vision Pro uses visible 64-point controls for machine selection, navigation,
closing sheets, shortcuts and settings. Close and Send include text, and card
actions wrap into labelled buttons. Voice remains the only editable-field path
on Vision Pro; the ordinary composer also stops opening its keyboard by default.

Start/Stop occupies its own full-width row in both Send and Terminal: 80 points
high on Vision Pro and 64 elsewhere. Cancel while connecting and Wait while
finishing keep the same target. Secondary controls and status text flow below
the draft instead of covering it. Recording, cancellation, screen-awake and
stop-and-send behavior are unchanged.

These are JavaScript-only updates for runtime 7 iOS/Android and the runtime 6
Android backport using its own lockfile. Native preview checks cover narrow/wide
layouts, light/dark themes and dictation states; actual gaze selection and
microphone comfort still require Vision Pro hardware.

## Android Terminal paragraphs (2026-11-06)

Android renders Terminal output as independent native text paragraphs per line.
ANSI formatting carries across lines, adjacent equal styles are merged, and
unchanged lines are memoized during capture updates. This avoids rebuilding one
large Android span collection for each changed capture. iOS keeps its existing
single-Text renderer. Follow, pinch zoom and full-output selection use the same
capture and controls.

Line identities also survive a rolling tail: dropping an old line and appending
a new one retains the other native paragraphs, including duplicate and blank
lines. Editing a line in place retains its paragraph key. This keeps memoization
effective as terminal output scrolls, without adding captured text to React keys.

This is JavaScript-only. Publish the Android production OTA separately for
runtime 7 and the runtime 6 backport with its existing dependencies. No new native
build is required. The publication check accepts the Controller's timestamp and
skills release labels, and still verifies the exact committed Web contract.

## Native card parity (2026-11-06)

Ordinary Android and iOS clients share the same card folding rules: recent cards
stay expanded, stale cards start collapsed, and opening or jumping to a stale
card expands its body. Existing large-screen and Vision presentation exceptions
are preserved. Android no longer eagerly expands every stale card.

Unchanged card Markdown also retains its rules when a parent callback changes;
file links still call the latest handler. This avoids parsing and rebuilding
retained replies during computer filtering and other parent updates. These are
JavaScript-only changes and require no new native build.
