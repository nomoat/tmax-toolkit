import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { holdDictationScreenAwake } from "./dictation-screen-awake";

vi.mock("expo-keep-awake", () => ({
  activateKeepAwakeAsync: vi.fn(),
  deactivateKeepAwake: vi.fn(),
}));
const activate = vi.mocked(activateKeepAwakeAsync);
const deactivate = vi.mocked(deactivateKeepAwake);

beforeEach(() => {
  vi.resetAllMocks();
  activate.mockResolvedValue(undefined);
  deactivate.mockResolvedValue(undefined);
});

describe("dictation screen wake lock", () => {
  it("holds the lock until capture cleanup, then releases the same tag once", async () => {
    const lock = holdDictationScreenAwake();
    await lock.ready;
    expect(activate).toHaveBeenCalledOnce();
    expect(deactivate).not.toHaveBeenCalled();
    const released = lock.release();
    expect(lock.release()).toBe(released);
    await released;
    expect(deactivate).toHaveBeenCalledExactlyOnceWith(activate.mock.calls[0][0]);
  });

  it("releases a late native activation after the user has cancelled", async () => {
    let finishActivation!: () => void;
    activate.mockReturnValue(new Promise<void>((resolve) => { finishActivation = resolve; }));
    const lock = holdDictationScreenAwake();
    const released = lock.release();
    await Promise.resolve();
    expect(deactivate).not.toHaveBeenCalled();
    finishActivation();
    await released;
    expect(deactivate).toHaveBeenCalledExactlyOnceWith(activate.mock.calls[0][0]);
  });

  it("does not unlock another composer or a newly started capture", async () => {
    const activeTags = new Set<string>();
    activate.mockImplementation(async (tag) => { activeTags.add(tag!); });
    deactivate.mockImplementation(async (tag) => { activeTags.delete(tag!); });
    const previous = holdDictationScreenAwake();
    const next = holdDictationScreenAwake();
    await Promise.all([previous.ready, next.ready]);
    expect(activeTags.size).toBe(2);
    await previous.release();
    expect(activeTags.size).toBe(1);
    expect(activeTags.has(activate.mock.calls[1][0]!)).toBe(true);
    await previous.release();
    expect(activeTags.size).toBe(1);
    await next.release();
    expect(activeTags.size).toBe(0);
  });

  it("surfaces activation failure and still cleans up a partially acquired lock", async () => {
    activate.mockRejectedValue(new Error("Activity unavailable"));
    const lock = holdDictationScreenAwake();
    await expect(lock.ready).rejects.toThrow("Activity unavailable");
    await expect(lock.release()).resolves.toBeUndefined();
    expect(deactivate).toHaveBeenCalledExactlyOnceWith(activate.mock.calls[0][0]);
  });

  it("handles cleanup after Android has already destroyed its Activity", async () => {
    deactivate.mockRejectedValue(new Error("Activity destroyed"));
    const lock = holdDictationScreenAwake();
    await lock.ready;
    await expect(lock.release()).resolves.toBeUndefined();
    await expect(lock.release()).resolves.toBeUndefined();
    expect(deactivate).toHaveBeenCalledOnce();
  });
});
