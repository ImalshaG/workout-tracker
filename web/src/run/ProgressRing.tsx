import { useId, type ReactNode } from 'react';

const R = 45;
const C = 2 * Math.PI * R;

/** Circular progress around the countdown. Exposes itself as a progressbar. */
export function ProgressRing({ progress, kind, label, children }: { progress: number; kind: 'work' | 'rest'; label: string; children: ReactNode }) {
  const gradientId = useId();
  const p = Math.min(Math.max(progress, 0), 1);
  return (
    <div
      className="relative mx-auto size-64 sm:size-72"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p * 100)}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="var(--color-brand-2)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" strokeWidth="6" className="stroke-line" />
        <circle
          cx="50" cy="50" r={R} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={kind === 'work' ? `url(#${gradientId})` : 'var(--color-rest)'}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-100 motion-safe:ease-linear"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
