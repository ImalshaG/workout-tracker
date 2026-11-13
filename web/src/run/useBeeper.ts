import { useCallback, useEffect, useRef } from 'react';

/** Short tones via Web Audio (no audio files). Silently does nothing if audio is unavailable. */
export function useBeeper(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const disposed = useRef(false);

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true; // late timers (e.g. the finish chime) must not reopen audio
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  return useCallback(
    (frequency: number, durationMs: number) => {
      if (muted || disposed.current) return;
      try {
        const ctx = (ctxRef.current ??= new AudioContext());
        if (ctx.state === 'suspended') ctx.resume().catch(() => {}); // may reject if closed meanwhile
        const t = ctx.currentTime;
        const end = t + durationMs / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(end + 0.02);
      } catch {
        // No audio available; the visual timer still works.
      }
    },
    [muted],
  );
}
