import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

let nextCapture = 0;

/** One native screen-sleep lock per capture, independent of other composers. */
export function holdDictationScreenAwake() {
  const tag = `tmux-mobile.dictation.${++nextCapture}`;
  const ready = activateKeepAwakeAsync(tag);
  let released: Promise<void> | undefined;
  return {
    ready,
    release() {
      // Cancellation can arrive before native activation finishes. Always release
      // after it settles, including a partially successful activation that rejects.
      return (released ??= ready
        .catch(() => {})
        .then(() => deactivateKeepAwake(tag))
        // Android may have already destroyed the Activity on background/unmount.
        .catch(() => {}));
    },
  };
}
