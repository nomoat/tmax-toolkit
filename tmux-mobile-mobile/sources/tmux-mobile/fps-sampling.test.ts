import { describe, expect, it, vi } from 'vitest';
import { frameWindow, sampleFrame, startJsFrameSampling } from './fps-sampling';
import { createFpsPreference, FPS_PREFERENCE_KEY } from './fps-preference';

describe('FPS sampling', () => {
  it.each([30, 60, 90, 120])('measures %i Hz without assuming a 60 Hz display', hz => {
    const window = frameWindow();
    const values: number[] = [];
    for (let frame = 0; frame <= hz * 3; frame++) {
      const value = sampleFrame(window, frame * 1000 / hz);
      if (value !== null) values.push(value);
    }
    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(values.every(value => value === hz)).toBe(true);
  });
  it('includes a long stalled frame and recovers in the next window', () => {
    const window = frameWindow();
    sampleFrame(window, 0);
    for (let i = 1; i <= 30; i++) sampleFrame(window, i * 1000 / 60);
    expect(sampleFrame(window, 1500)).toBe(21);
    let fps: number | null = null;
    for (let i = 1; i <= 60; i++) fps = sampleFrame(window, 1500 + i * 1000 / 60) ?? fps;
    expect(fps).toBe(60);
  });
  it('ignores duplicate/invalid timestamps and resets a changed time origin', () => {
    const window = frameWindow();
    sampleFrame(window, 500); sampleFrame(window, 500); sampleFrame(window, NaN);
    expect(window.frames).toBe(0);
    sampleFrame(window, 400);
    expect(window.elapsed).toBe(0);
    expect(sampleFrame(window, 1400)).toBe(1);
  });
  it('stops scheduled work and ignores a late callback after disabling/backgrounding', () => {
    const queued = new Map<number, (time: number) => void>();
    let id = 0;
    const request = vi.fn((fn: (time: number) => void) => { queued.set(++id, fn); return id; });
    const cancel = vi.fn((id: number) => { queued.delete(id); });
    const report = vi.fn();
    const tick = (time: number) => { const [id, fn] = [...queued][0]; queued.delete(id); fn(time); };
    const stop = startJsFrameSampling(report, request, cancel);
    tick(0); tick(1000);
    expect(report).toHaveBeenCalledWith(1);
    const late = [...queued.values()][0];
    stop(); late(2000);
    expect(queued.size).toBe(0);
    expect(request).toHaveBeenCalledTimes(3);
    expect(report).toHaveBeenCalledTimes(1);
    // A new foreground session does not count time spent in the background.
    const stopAgain = startJsFrameSampling(report, request, cancel);
    tick(600000);
    expect(report).toHaveBeenCalledTimes(1);
    stopAgain();
  });
});

describe('FPS preference', () => {
  it('defaults off and restores the saved opt-in', async () => {
    const storage = { getItem: vi.fn(async () => 'true'), setItem: vi.fn(async () => {}) };
    const preference = createFpsPreference(storage);
    expect(preference.getSnapshot()).toBe(false);
    await Promise.all([preference.load(), preference.load()]);
    expect(preference.getSnapshot()).toBe(true);
    expect(storage.getItem).toHaveBeenCalledExactlyOnceWith(FPS_PREFERENCE_KEY);
  });
  it('does not overwrite a new toggle when a slow saved preference arrives', async () => {
    let resolve!: (value: string) => void;
    const storage = { getItem: () => new Promise<string>(done => { resolve = done; }), setItem: vi.fn(async () => {}) };
    const preference = createFpsPreference(storage);
    const loaded = preference.load();
    await preference.setEnabled(false);
    resolve('true'); await loaded;
    expect(preference.getSnapshot()).toBe(false);
    expect(storage.setItem).toHaveBeenCalledWith(FPS_PREFERENCE_KEY, 'false');
  });
  it('serializes rapid toggle writes and keeps working after a storage failure', async () => {
    const writes: string[] = [];
    const storage = { getItem: async () => { throw Error('unavailable'); }, setItem: vi.fn(async (_key: string, value: string) => { writes.push(value); if (writes.length === 1) throw Error('unavailable'); }) };
    const preference = createFpsPreference(storage);
    await preference.load();
    expect(preference.getSnapshot()).toBe(false);
    const changed = vi.fn(); const unsubscribe = preference.subscribe(changed);
    await Promise.all([preference.setEnabled(true), preference.setEnabled(false), preference.setEnabled(true)]);
    expect(writes).toEqual(['true', 'false', 'true']);
    expect(preference.getSnapshot()).toBe(true);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe(); await preference.setEnabled(false);
    expect(changed).toHaveBeenCalledTimes(3);
  });
});
