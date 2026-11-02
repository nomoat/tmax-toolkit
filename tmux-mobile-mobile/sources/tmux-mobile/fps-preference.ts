export const FPS_PREFERENCE_KEY = 'tmux-mobile.show-fps.v1';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };

export function createFpsPreference(storage: Storage) {
  let enabled = false;
  let revision = 0;
  let loading: Promise<void> | undefined;
  let writes: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const update = (next: boolean) => {
    if (enabled === next) return;
    enabled = next; listeners.forEach(listener => listener());
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => enabled,
    load() {
      if (!loading) {
        const initialRevision = revision;
        loading = storage.getItem(FPS_PREFERENCE_KEY).then(value => {
          if (revision === initialRevision) update(value === 'true');
        }).catch(() => {});
      }
      return loading;
    },
    setEnabled(next: boolean) {
      revision += 1;
      update(next);
      writes = writes.then(() => storage.setItem(FPS_PREFERENCE_KEY, String(next))).catch(() => {});
      return writes;
    },
  };
}
