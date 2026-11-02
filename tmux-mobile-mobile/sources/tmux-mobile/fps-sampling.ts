// Shared math for the native UI worklet and JavaScript requestAnimationFrame.
export type FrameWindow = { previous: number | null; elapsed: number; frames: number };
export function frameWindow(): FrameWindow {
  'worklet';
  return { previous: null, elapsed: 0, frames: 0 };
}
export function sampleFrame(window: FrameWindow, timestamp: number): number | null {
  'worklet';
  if (!Number.isFinite(timestamp)) return null;
  if (window.previous === null || timestamp < window.previous) {
    window.previous = timestamp; window.elapsed = 0; window.frames = 0;
    return null;
  }
  const elapsed = timestamp - window.previous;
  if (elapsed <= 0) return null;
  window.previous = timestamp;
  window.elapsed += elapsed;
  window.frames += 1;
  if (window.elapsed < 1000) return null;
  // Include long frames: dropping them would hide the stalls this measures.
  const fps = Math.round(window.frames * 1000 / window.elapsed);
  window.elapsed = 0; window.frames = 0;
  return fps;
}

export function startJsFrameSampling(
  report: (fps: number) => void,
  request: (callback: (time: number) => void) => number,
  cancel: (id: number) => void,
) {
  const window = frameWindow();
  let stopped = false;
  let pending: number;
  const frame = (time: number) => {
    if (stopped) return;
    const fps = sampleFrame(window, time);
    if (fps !== null) report(fps);
    if (!stopped) pending = request(frame);
  };
  pending = request(frame);
  return () => { stopped = true; cancel(pending); };
}
