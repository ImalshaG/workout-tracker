/** Compact duration for UI labels: "45s", "1m", "1m 30s", "1h 5m". */
export function formatShortDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return sec ? `${m}m ${sec}s` : `${m}m`;
}

export const DURATION_MIN_SECONDS = 1;
export const DURATION_MAX_SECONDS = 3600;
export const REST_MAX_SECONDS = 600;
export const DEFAULT_DURATION_SECONDS = 30;
export const DEFAULT_REST_SECONDS = 10;
