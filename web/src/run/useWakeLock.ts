import { useEffect } from 'react';

/** Keeps the screen awake while `active` (where the browser supports the Screen Wake Lock API). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) void l.release().catch(() => {});
        else lock = l;
      } catch {
        // Denied or unsupported (e.g. tab hidden); not essential.
      }
    };
    // The lock is dropped when the tab is hidden; take it again when it's visible.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
