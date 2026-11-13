# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the web app with a warm, energetic, desktop-first look (sidebar shell, cards, icons, display numbers) and add UX polish (start-workout picker, last-done info, exercise search, toasts, overflow menus) without API changes.

**Architecture:** Design tokens live in Tailwind v4 `@theme` in `web/src/index.css` and are overridden for dark mode on `:root`. A small component kit in `web/src/components/` (Button, IconButton, Card, Badge, StatCard, EmptyState, Menu, Toast) replaces long class strings in pages. New pure helpers (`lastRun.ts`, `filter.ts`) carry unit tests; pages are restyled one at a time on top of the kit.

**Tech Stack:** React 19, React Router 8, TanStack Query 5, Tailwind CSS 4, Vite 8, Vitest 5, dnd-kit, `lucide-react` (new), `@fontsource-variable/outfit` + `@fontsource/barlow-condensed` (new).

**Spec:** `docs/superpowers/specs/2026-11-13-ui-redesign-design.md`

## Global Constraints

- No changes under `server/`. No new API endpoints.
- Desktop first; usable down to 375px wide (sidebar becomes a top bar under 768px / `md`).
- Dark mode keeps following `prefers-color-scheme`; every colour used must come from a token or have a `dark:` pair.
- Text contrast ≥ 4.5:1. White text only on `brand-fill` (`#c2410c`). Bright `brand` (`#f97316`) is for non-text accents (rings, flame, icons, bars).
- Keep every existing `aria-*`, `role`, `data-testid`, keyboard shortcut and focus behaviour.
- Icon-only controls have an accessible name; decorative icons get `aria-hidden` (lucide sets `aria-hidden="true"` by default).
- Animations only under `motion-safe:`.
- App name: "Workout Tracker".
- Run from `web/`: `npm test`, `npm run typecheck`, `npm run build` must all pass at the end of every task.

## File map

| File | Responsibility |
| --- | --- |
| `web/src/index.css` | Tokens, fonts, base body styles, keyframes |
| `web/index.html` | Title + favicon |
| `web/src/main.tsx` | Font imports, `ToastProvider` |
| `web/src/components/ui.tsx` | Button, IconButton, Card, Badge, StatCard, EmptyState, PageHeader, StatusLine, LoadError, FieldError, inputClass |
| `web/src/components/Menu.tsx` | Accessible "⋯" overflow menu |
| `web/src/components/Toast.tsx` | Toast provider + `useToast` |
| `web/src/components/Modal.tsx`, `ConfirmDialog.tsx`, `SecondsInput.tsx`, `NotFound.tsx` | Restyle |
| `web/src/components/Layout.tsx` | Sidebar shell |
| `web/src/workouts/lastRun.ts` (+ test) | `lastRunByWorkout`, `formatLastDone`, `startableWorkouts` |
| `web/src/workouts/useLastRuns.ts` | Query hook over all runs |
| `web/src/workouts/StartWorkoutDialog.tsx` | Sidebar picker |
| `web/src/exercises/filter.ts` (+ test) | `filterByName` |
| `web/src/api/runs.ts` | `listRuns` optional bounds, `runKeys.allRuns` |
| `web/src/run/ProgressRing.tsx` | SVG countdown ring |
| Pages | Progress, Workouts, WorkoutDetail, SortableExerciseList, ExerciseSelection, dialogs, Run, Exercises |

---

### Task 1: Foundations (tokens, fonts, component kit, toasts, menu)

**Files:**
- Modify: `web/package.json` (deps), `web/index.html`, `web/src/index.css`, `web/src/main.tsx`, `web/src/components/ui.tsx`, `web/src/components/Modal.tsx`, `web/src/components/ConfirmDialog.tsx`, `web/src/components/SecondsInput.tsx`
- Create: `web/src/components/Menu.tsx`, `web/src/components/Toast.tsx`

**Interfaces — Produces:**
- `Button(props: ComponentProps<'button'> & { variant?: ButtonVariant; size?: 'sm' | 'md'; icon?: LucideIcon })`
- `buttonClass(variant?: ButtonVariant, extra?: string, size?: 'sm' | 'md'): string`; `ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghostDanger'`
- `IconButton(props: ComponentProps<'button'> & { label: string; icon: LucideIcon; variant?: 'ghost' | 'ghostDanger' })`
- `Card(props: ComponentProps<'div'> & { as?: 'div' | 'section' | 'li' | 'article'; padding?: 'none' | 'sm' | 'md' })`
- `Badge({ icon?: LucideIcon; children; tone?: 'brand' | 'neutral' })`
- `StatCard({ label, value, note?, highlight?, testId })`
- `EmptyState({ icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode })`
- `PageHeader({ title, subtitle?, action? })`
- `Menu({ label: string; items: MenuItem[] })`, `MenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean }`
- `ToastProvider`, `useToast(): (message: string) => void`
- `focusRing` class string constant
- `AddButton` is removed (callers migrate in later tasks; keep it until Task 8 removes the last caller).

- [ ] **Step 1: Install dependencies**

Run (in `web/`): `npm install lucide-react@1.72.0 @fontsource-variable/outfit@5.3.0 @fontsource/barlow-condensed@5.3.0`
Expected: added to `dependencies`.

- [ ] **Step 2: Tokens and base styles** — replace `web/src/index.css`:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Outfit Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Barlow Condensed", "Outfit Variable", ui-sans-serif, sans-serif;

  /* Decorative accent (rings, flame, bars). Not for text. */
  --color-brand: #f97316;
  --color-brand-2: #f59e0b;
  /* Background for white text (5.2:1). Same in both themes. */
  --color-brand-fill: #c2410c;
  --color-brand-fill-hover: #9a3412;
  /* Accent text on canvas/surface/soft. */
  --color-brand-ink: #c2410c;
  --color-brand-soft: #ffedd5;

  --color-canvas: #fffaf5;
  --color-surface: #ffffff;
  --color-sunken: #fdf3e8;
  --color-line: #f1e4d6;
  --color-ink: #1c1410;
  --color-muted: #75655a;
  --color-rest: #0f766e;
  --color-rest-soft: #ccfbf1;

  --radius-card: 14px;
  --shadow-card: 0 1px 2px rgb(120 60 10 / 0.06), 0 4px 14px rgb(120 60 10 / 0.06);
  --shadow-brand: 0 4px 14px rgb(194 65 12 / 0.28);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-brand-ink: #fdba74;
    --color-brand-soft: #431407;
    --color-canvas: #0c0a09;
    --color-surface: #1c1917;
    --color-sunken: #171412;
    --color-line: #2e2925;
    --color-ink: #f5f5f4;
    --color-muted: #a8a29e;
    --color-rest: #2dd4bf;
    --color-rest-soft: #042f2e;
    --shadow-card: 0 1px 2px rgb(0 0 0 / 0.4), 0 4px 14px rgb(0 0 0 / 0.25);
    --shadow-brand: 0 4px 14px rgb(0 0 0 / 0.4);
  }
}

:root {
  color-scheme: light dark;
}

body {
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: none; }
}
```

- [ ] **Step 3: Fonts + toast provider in `web/src/main.tsx`** — add at top `import '@fontsource-variable/outfit';`, `import '@fontsource/barlow-condensed/600.css';`, `import '@fontsource/barlow-condensed/700.css';` (before `./index.css`), and wrap `<BrowserRouter>` contents: `<ToastProvider><App /></ToastProvider>`.

- [ ] **Step 4: `web/index.html`** — title `Workout Tracker`; add
`<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔥</text></svg>" />`.

- [ ] **Step 5: Component kit** — rewrite `web/src/components/ui.tsx`:

```tsx
import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink shadow-xs placeholder:text-muted ' +
  'focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/25 aria-[invalid=true]:border-red-500';

const variants = {
  primary: 'bg-brand-fill text-white shadow-brand hover:bg-brand-fill-hover',
  secondary: 'border border-line bg-surface text-ink shadow-xs hover:bg-sunken',
  ghost: 'text-ink/80 hover:bg-sunken hover:text-ink',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghostDanger: 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60',
} as const;
export type ButtonVariant = keyof typeof variants;

const sizes = { sm: 'gap-1.5 px-2.5 py-1 text-sm', md: 'gap-2 px-3.5 py-2 text-sm' } as const;

/** Button styling, also usable on links that should look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', extra = '', size: keyof typeof sizes = 'md') {
  return [
    'inline-flex items-center justify-center rounded-[10px] font-semibold whitespace-nowrap',
    'motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    focusRing, sizes[size], variants[variant], extra,
  ].join(' ');
}

export function Button({
  variant = 'secondary', size = 'md', icon: Icon, className = '', type = 'button', children, ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: keyof typeof sizes; icon?: LucideIcon }) {
  return (
    <button type={type} className={buttonClass(variant, className, size)} {...props}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Square icon-only button; `label` is its accessible name and tooltip. */
export function IconButton({
  label, icon: Icon, variant = 'ghost', className = '', type = 'button', ...props
}: ComponentProps<'button'> & { label: string; icon: LucideIcon; variant?: 'ghost' | 'ghostDanger' }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-[10px] motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  );
}

const paddings = { none: '', sm: 'p-3', md: 'p-5' } as const;

export function Card({
  as: Tag = 'div', padding = 'md', className = '', ...props
}: ComponentProps<'div'> & { as?: 'div' | 'section' | 'li' | 'article'; padding?: keyof typeof paddings }) {
  return <Tag className={`rounded-card border border-line bg-surface shadow-card ${paddings[padding]} ${className}`} {...(props as object)} />;
}

export function Badge({ icon: Icon, tone = 'brand', children }: { icon?: LucideIcon; tone?: 'brand' | 'neutral'; children: ReactNode }) {
  const toneClass = tone === 'brand' ? 'bg-brand-soft text-brand-ink' : 'bg-sunken text-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${toneClass}`}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatCard({ label, value, note, highlight = false, testId }: {
  label: string; value: ReactNode; note?: string | undefined; highlight?: boolean; testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={
        'rounded-card border px-4 py-3 shadow-card ' +
        (highlight
          ? 'border-orange-200 bg-linear-to-br from-orange-50 to-amber-100 dark:border-orange-900 dark:from-orange-950/60 dark:to-amber-950/40'
          : 'border-line bg-surface')
      }
    >
      <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-3xl leading-none font-bold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs leading-tight text-muted">{note}</dd>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">{message}</p>;
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-muted" role="status">{children}</p>;
}

export function LoadError({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40" role="alert">
      <p className="flex-1 text-red-800 dark:text-red-300">Couldn't load {what}.</p>
      <Button onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying…' : 'Retry'}</Button>
    </div>
  );
}

/** @deprecated Removed once the last page migrates to a labelled primary Button. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button variant="primary" onClick={onClick}>{label}</Button>;
}
```

- [ ] **Step 6: Toasts** — create `web/src/components/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';

const ToastContext = createContext<(message: string) => void>(() => {});
const DISMISS_MS = 4000;
const MAX_TOASTS = 3;

/** Success confirmations only; errors stay inline where they happened. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const nextId = useRef(1);
  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-(MAX_TOASTS - 1)), { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), DISMISS_MS);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted so screen readers pick up new messages. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg motion-safe:animate-[toast-in_.2s_ease-out] dark:bg-stone-100 dark:text-stone-900">
            <CircleCheck className="size-4 text-emerald-400 dark:text-emerald-600" aria-hidden="true" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

- [ ] **Step 7: Menu** — create `web/src/components/Menu.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import { focusRing } from './ui';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** "⋯" overflow menu (menu button pattern): arrows move, Escape/Tab/outside click close, focus returns to the button. */
export function Menu({ label, items, className = '' }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const itemEls = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    itemEls()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onListKeyDown(e: KeyboardEvent) {
    const els = itemEls();
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    const move = (n: number) => els[(i + n + els.length) % els.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els.at(-1)?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        className={`grid size-9 place-items-center rounded-[10px] text-muted hover:bg-sunken hover:text-ink ${focusRing}`}
      >
        <Ellipsis className="size-5" aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onListKeyDown}
          className="absolute top-full right-0 z-30 mt-1 min-w-44 rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => { close(); item.onSelect(); }}
              className={
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium focus:outline-none disabled:opacity-50 ' +
                (item.danger ? 'text-red-700 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60 dark:focus:bg-red-950/60' : 'hover:bg-sunken focus:bg-sunken')
              }
            >
              {item.icon && <item.icon className="size-4" aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Note: `close()` refocuses the menu button before `onSelect` runs, so a dialog opened by `onSelect` records the menu button as its opener and returns focus there.

- [ ] **Step 8: Restyle Modal / ConfirmDialog / SecondsInput**
  - `Modal.tsx` dialog class → `'m-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl backdrop:bg-stone-950/40 backdrop:backdrop-blur-sm ' + className`.
  - `ConfirmDialog.tsx`: wrap message in `flex gap-3` with a `TriangleAlert` icon (`size-5 shrink-0 text-red-600 mt-0.5`) when `confirmLabel` is set; Cancel/Close stays `data-autofocus`.
  - `SecondsInput.tsx`: `text-zinc-500` → `text-muted`; `InlineSeconds` input classes → `'w-16 rounded-lg border bg-surface px-2 py-1 text-right tabular-nums focus:border-brand focus:ring-3 focus:ring-brand/25 focus:outline-none disabled:opacity-50 ' + (custom ? 'border-brand text-brand-ink font-semibold' : 'border-line')`.

- [ ] **Step 9: Verify** — `npm run typecheck && npm test && npm run build`. Expected: all pass (pages still use the old class names, which still exist in Tailwind).

- [ ] **Step 10: Commit** — `git add -A web && git commit -m "feat(web): design tokens, fonts, icons and component kit"`

---

### Task 2: Pure helpers (last run, picker order, name filter) with tests

**Files:**
- Create: `web/src/workouts/lastRun.ts`, `web/src/workouts/lastRun.test.ts`, `web/src/exercises/filter.ts`, `web/src/exercises/filter.test.ts`, `web/src/workouts/useLastRuns.ts`
- Modify: `web/src/api/runs.ts`

**Interfaces — Produces:**
- `lastRunByWorkout(runs: readonly { workoutId: number | null; completedAt: number }[]): Map<number, number>`
- `formatLastDone(ms: number | undefined, now: Date, locale?: string): string` → `'Never' | 'Today' | 'Yesterday' | '5 Nov' | '5 Nov 2025'`
- `startableWorkouts<W extends { id: number; name: string; exerciseCount: number }>(workouts: readonly W[], last: Map<number, number> | null): W[]`
- `filterByName<T extends { name: string }>(items: readonly T[], query: string): T[]`
- `listRuns(from?: number, to?: number)`, `runKeys.allRuns() => ['runs', 'all']`
- `useLastRuns(): Map<number, number> | null` (null while loading or on error)

- [ ] **Step 1: Failing tests** — `web/src/workouts/lastRun.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatLastDone, lastRunByWorkout, startableWorkouts } from './lastRun';

describe('lastRunByWorkout', () => {
  it('keeps the latest completion per workout and skips deleted workouts', () => {
    const map = lastRunByWorkout([
      { workoutId: 1, completedAt: 100 },
      { workoutId: 2, completedAt: 50 },
      { workoutId: 1, completedAt: 300 },
      { workoutId: null, completedAt: 999 },
      { workoutId: 1, completedAt: 200 },
    ]);
    expect([...map]).toEqual([[1, 300], [2, 50]]);
  });
});

describe('formatLastDone', () => {
  const now = new Date(2026, 10, 13, 9, 0); // Fri 13 Nov 2026
  it('says Never without a run', () => expect(formatLastDone(undefined, now, 'en-GB')).toBe('Never'));
  it('says Today and Yesterday by calendar day', () => {
    expect(formatLastDone(new Date(2026, 10, 13, 0, 5).getTime(), now, 'en-GB')).toBe('Today');
    expect(formatLastDone(new Date(2026, 10, 12, 23, 59).getTime(), now, 'en-GB')).toBe('Yesterday');
  });
  it('uses a short date, with the year only when it differs', () => {
    expect(formatLastDone(new Date(2026, 10, 5).getTime(), now, 'en-GB')).toBe('5 Nov');
    expect(formatLastDone(new Date(2025, 10, 5).getTime(), now, 'en-GB')).toBe('5 Nov 2025');
  });
});

describe('startableWorkouts', () => {
  const w = (id: number, name: string, exerciseCount = 1) => ({ id, name, exerciseCount });
  it('drops empty workouts and orders by most recent run, then name', () => {
    const list = [w(1, 'Zed'), w(2, 'Arms'), w(3, 'Empty', 0), w(4, 'Core'), w(5, 'Back')];
    const last = new Map([[4, 500], [1, 900]]);
    expect(startableWorkouts(list, last).map((x) => x.id)).toEqual([1, 4, 2, 5]);
  });
  it('sorts by name when run history is unavailable', () => {
    expect(startableWorkouts([w(1, 'b'), w(2, 'A')], null).map((x) => x.id)).toEqual([2, 1]);
  });
});
```

`web/src/exercises/filter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filterByName } from './filter';

const items = [{ name: 'Plank' }, { name: 'Side plank' }, { name: 'Squat' }];

describe('filterByName', () => {
  it('returns everything for a blank query', () => expect(filterByName(items, '  ')).toEqual(items));
  it('matches anywhere in the name, ignoring case and outer spaces', () => {
    expect(filterByName(items, ' PLANK ')).toEqual([{ name: 'Plank' }, { name: 'Side plank' }]);
  });
  it('returns nothing when nothing matches', () => expect(filterByName(items, 'lunge')).toEqual([]));
});
```

- [ ] **Step 2: Run, expect failure** — `npx vitest run src/workouts/lastRun.test.ts src/exercises/filter.test.ts` → FAIL (modules not found).

- [ ] **Step 3: Implement** — `web/src/workouts/lastRun.ts`:

```ts
import { addDays, sameDay } from '../progress/dates';

/** Latest `completedAt` per workout (runs of deleted workouts are skipped). */
export function lastRunByWorkout(runs: readonly { workoutId: number | null; completedAt: number }[]): Map<number, number> {
  const last = new Map<number, number>();
  for (const r of runs) {
    if (r.workoutId === null) continue;
    if (r.completedAt > (last.get(r.workoutId) ?? -Infinity)) last.set(r.workoutId, r.completedAt);
  }
  return last;
}

/** "Never", "Today", "Yesterday", "5 Nov", or "5 Nov 2025" for another year. */
export function formatLastDone(ms: number | undefined, now: Date, locale?: string): string {
  if (ms === undefined) return 'Never';
  const d = new Date(ms);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, addDays(now, -1))) return 'Yesterday';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Workouts that can be run, most recently done first, then by name. */
export function startableWorkouts<W extends { id: number; name: string; exerciseCount: number }>(
  workouts: readonly W[],
  last: Map<number, number> | null,
): W[] {
  return workouts
    .filter((w) => w.exerciseCount > 0)
    .sort((a, b) => (last?.get(b.id) ?? -1) - (last?.get(a.id) ?? -1) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
```

`web/src/exercises/filter.ts`:

```ts
/** Items whose name contains `query` (trimmed, case-insensitive). A blank query keeps everything. */
export function filterByName<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? items.filter((i) => i.name.toLocaleLowerCase().includes(q)) : [...items];
}
```

- [ ] **Step 4: Run, expect pass** — same command → PASS.

- [ ] **Step 5: API + hook** — in `web/src/api/runs.ts` add `allRuns: () => ['runs', 'all'] as const` to `runKeys`, and change `listRuns`:

```ts
/** Completed runs, optionally limited to `completedAt` in [from, to). */
export async function listRuns(from?: number, to?: number): Promise<Run[]> {
  const query: { from?: string; to?: string } = {};
  if (from !== undefined) query.from = String(from);
  if (to !== undefined) query.to = String(to);
  return unwrap(await api.$get({ query }));
}
```

Create `web/src/workouts/useLastRuns.ts`:

```ts
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRuns, runKeys } from '../api/runs';
import { lastRunByWorkout } from './lastRun';

/** Latest completion per workout id; null while loading or if history can't be loaded (callers degrade quietly). */
export function useLastRuns(): Map<number, number> | null {
  const query = useQuery({ queryKey: runKeys.allRuns(), queryFn: () => listRuns() });
  return useMemo(() => (query.data ? lastRunByWorkout(query.data) : null), [query.data]);
}
```

- [ ] **Step 6: Verify** — `npm run typecheck && npm test` → pass.
- [ ] **Step 7: Commit** — `git commit -am "feat(web): last-run, picker order and name filter helpers"` (add new files first).

---

### Task 3: Sidebar shell, Start-workout picker, Not found

**Files:**
- Modify: `web/src/components/Layout.tsx`, `web/src/components/NotFound.tsx`
- Create: `web/src/workouts/StartWorkoutDialog.tsx`

**Interfaces — Consumes:** `Button`, `Badge`, `EmptyState`, `focusRing` (Task 1); `useLastRuns`, `startableWorkouts`, `formatLastDone` (Task 2). **Produces:** `StartWorkoutDialog({ open, onClose })`.

- [ ] **Step 1: Layout** — rewrite `Layout.tsx`:

```tsx
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { CalendarDays, Dumbbell, Flame, ListChecks, Play, type LucideIcon } from 'lucide-react';
import { StartWorkoutDialog } from '../workouts/StartWorkoutDialog';
import { buttonClass, focusRing } from './ui';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Progress', icon: CalendarDays, end: true },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: ListChecks },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium motion-safe:transition-colors ${focusRing} ` +
  (isActive ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-muted hover:bg-sunken hover:text-ink');

export function Layout() {
  const [starting, setStarting] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className={`sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 ${focusRing}`}>
        Skip to content
      </a>
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur md:h-screen md:w-60 md:shrink-0 md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link to="/" className={`flex items-center gap-2.5 rounded-lg px-1 py-1 md:mb-8 md:px-2 ${focusRing}`}>
          <span className="grid size-8 place-items-center rounded-[10px] bg-linear-to-br from-brand to-brand-2 text-white shadow-brand">
            <Flame className="size-4.5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight md:inline">Workout Tracker</span>
          <span className="sr-only md:hidden">Workout Tracker</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1 md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass} title={label}>
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />
              <span className="sr-only md:not-sr-only">{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={() => setStarting(true)} className={buttonClass('primary', 'ml-auto md:mt-6 md:ml-0')}>
          <Play className="size-4 fill-current" aria-hidden="true" />
          <span className="sr-only md:not-sr-only">Start workout</span>
        </button>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-[880px]">
          <Outlet />
        </div>
      </main>
      <StartWorkoutDialog open={starting} onClose={() => setStarting(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Picker** — create `web/src/workouts/StartWorkoutDialog.tsx`:

```tsx
import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Clock, Dumbbell, ListChecks, Play } from 'lucide-react';
import { listWorkouts, workoutKeys } from '../api/workouts';
import { Modal } from '../components/Modal';
import { Badge, Button, buttonClass, EmptyState, focusRing, LoadError, StatusLine } from '../components/ui';
import { formatShortDuration } from '../time';
import { formatLastDone, startableWorkouts } from './lastRun';
import { useLastRuns } from './useLastRuns';

export function StartWorkoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const headingId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} className="w-[min(32rem,calc(100%-2rem))]">
      <Picker headingId={headingId} onClose={onClose} />
    </Modal>
  );
}

function Picker({ headingId, onClose }: { headingId: string; onClose: () => void }) {
  const query = useQuery({ queryKey: workoutKeys.list(), queryFn: listWorkouts });
  const last = useLastRuns();
  const now = new Date();
  const workouts = query.data ? startableWorkouts(query.data, last) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id={headingId} className="text-xl font-bold">Start a workout</h2>
        <Button variant="ghost" size="sm" onClick={onClose} data-autofocus>Close</Button>
      </div>
      {query.isPending ? (
        <StatusLine>Loading workouts…</StatusLine>
      ) : query.isError ? (
        <LoadError what="workouts" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : workouts.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No workouts to start yet"
          action={<Link to="/workouts" onClick={onClose} className={buttonClass('primary')}>Go to workouts</Link>}
        >
          Create a workout and add a few exercises to it first.
        </EmptyState>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-0.5">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workouts/${w.id}/run`}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 hover:border-brand/50 hover:bg-sunken ${focusRing}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold break-words">{w.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge icon={ListChecks}>{w.exerciseCount} exercise{w.exerciseCount === 1 ? '' : 's'}</Badge>
                    <Badge icon={Clock}>{formatShortDuration(w.totalSeconds)}</Badge>
                    {last && <span className="text-xs text-muted">Last done: {formatLastDone(last.get(w.id), now)}</span>}
                  </div>
                </div>
                <span className="grid size-9 place-items-center rounded-full bg-brand-fill text-white" aria-hidden="true">
                  <Play className="size-4 fill-current" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: NotFound** — rewrite to use `PageHeader` + `EmptyState` (`SearchX`, title "Nothing here", action = `Link` styled `buttonClass('primary')` with `backLabel`). Keep the same props/defaults.

- [ ] **Step 4: Verify** — typecheck, tests, build. Manual: `npm run dev` from repo root; sidebar renders, active link highlighted, picker opens, Escape closes and focus returns to the button, a workout link opens the timer; at 375px the top bar shows icon-only links.
- [ ] **Step 5: Commit** — `git add -A web && git commit -m "feat(web): sidebar shell and start-workout picker"`

---

### Task 4: Progress page

**Files:** Modify `web/src/progress/ProgressPage.tsx`

**Consumes:** `Card`, `StatCard`, `Button`, `IconButton`, `Menu`, `useToast`, `PageHeader`.

- [ ] **Step 1:** Replace the local `Stat` component with `StatCard` (same labels, values, notes, `testId`s, `highlight`). Delete `Stat`.
- [ ] **Step 2:** Layout of the returned JSX:

```tsx
<PageHeader title="Your progress" subtitle="Every day you train keeps the flame alive." />
{query.isError && !query.data ? <LoadError … /> : (
  <>
    <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">{/* three StatCards */}</dl>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card padding="sm" className="sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shiftMonth(-1)} />
          <h2 className="text-lg font-semibold" aria-live="polite">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={() => selectDay(today)} disabled={…}>Today</Button>
            <IconButton icon={ChevronRight} label="Next month" onClick={() => shiftMonth(1)} />
          </div>
        </div>
        {/* existing <table> unchanged except: th text-zinc-500 → text-muted */}
        {/* legend + hint: text-zinc-500 → text-muted */}
      </Card>
      <div>{selected ? <DayDetails … /> : <EmptyState icon={CalendarDays} title="Pick a day">See the workouts you finished on any day.</EmptyState>}</div>
    </div>
  </>
)}
```

- [ ] **Step 3: DayCell** — replace remaining zinc/indigo classes: hover `group-hover:bg-sunken`; today (not done) `font-bold text-brand-ink`; selected ring `ring-2 ring-brand ring-offset-2 ring-offset-surface`; focus outline `group-focus-visible:outline-brand`; today dot `bg-brand`; run-count badge `bg-ink text-canvas`. Keep all data attributes, aria, heat classes, streak bands and flame.
- [ ] **Step 4: DayDetails** — section stays `aria-labelledby="day-heading"`; drop `mt-8` (grid handles spacing); heading `text-lg font-semibold`; each run is `<Card as="li" padding="sm" data-testid="day-run">` in a `space-y-2` list, with time/duration line `text-muted`, `<details>` summary `text-muted`, and the Remove button replaced by `<Menu label={`Actions for ${run.workoutName} at ${time(run.completedAt)}`} items={[{ label: 'Remove from history', icon: Trash2, danger: true, onSelect: () => { remove.reset(); setConfirming(run); } }]} />`. In `remove`'s `onSuccess` also call `toast('Removed from your history')`. Workout link: `font-semibold hover:text-brand-ink`.
  - Note: the old Remove button had `aria-label="Remove {name} at {time} from history"`; the menu button now carries `Actions for …` and the item reads "Remove from history".
- [ ] **Step 5: Verify** — typecheck/tests/build; manual: arrows/PageUp still move days, stats show, removing a run shows a toast, dark mode readable.
- [ ] **Step 6: Commit** — `git commit -am "feat(web): restyle progress page"`

---

### Task 5: Workouts page, RunLink, new-workout dialog

**Files:** Modify `web/src/workouts/WorkoutsPage.tsx`, `web/src/workouts/RunLink.tsx`, `web/src/workouts/NewWorkoutDialog.tsx`, `web/src/workouts/ExerciseSelection.tsx`

**Consumes:** `useLastRuns`, `formatLastDone`, `Card`, `Badge`, `Menu`, `EmptyState`, `useToast`.

- [ ] **Step 1: RunLink** — new signature `RunLink({ workoutId, exerciseCount, className = '' })`; label `Start` with a filled `Play` icon; enabled = `Link` with `buttonClass('primary', className)`; disabled = `span` with `aria-disabled="true"` and `title="Add exercises to run this workout"`. Remove the `compact` prop and update callers.
- [ ] **Step 2: WorkoutsPage** —
  - Header: `<PageHeader title="Workouts" subtitle="Build routines from your exercises, then start one." action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New workout</Button>} />`.
  - Empty: `EmptyState icon={Dumbbell} title="No workouts yet"` with action "Create your first workout".
  - List: `<ul className="grid gap-4 sm:grid-cols-2">`; each item:

```tsx
<Card as="li" key={workout.id} className="relative flex flex-col hover:border-brand/40 motion-safe:transition-colors">
  <div className="flex items-start justify-between gap-2">
    <h2 className="min-w-0 text-lg font-bold break-words">
      <Link to={`/workouts/${workout.id}`} className={`rounded after:absolute after:inset-0 after:rounded-card ${focusRing}`}>
        {workout.name}
      </Link>
    </h2>
    <Menu className="relative z-10 -mt-1 -mr-2" label={`Actions for ${workout.name}`} items={[
      { label: 'Edit', icon: Pencil, onSelect: () => navigate(`/workouts/${workout.id}`) },
      { label: 'Delete', icon: Trash2, danger: true, disabled: remove.isPending && remove.variables?.id === workout.id,
        onSelect: () => { remove.reset(); setConfirming(workout); } },
    ]} />
  </div>
  <div className="mt-2 flex flex-wrap gap-1.5">
    <Badge icon={ListChecks}>{workout.exerciseCount} exercise{workout.exerciseCount === 1 ? '' : 's'}</Badge>
    {workout.exerciseCount > 0 && <Badge icon={Clock}>{formatShortDuration(workout.totalSeconds)}</Badge>}
  </div>
  {last && <p className="mt-3 text-sm text-muted">Last done: {formatLastDone(last.get(workout.id), now)}</p>}
  <RunLink workoutId={workout.id} exerciseCount={workout.exerciseCount} className="relative z-10 mt-4 w-full" />
</Card>
```

  - After the items, a dashed tile: `<li><button type="button" onClick={() => setCreating(true)} className={`grid h-full min-h-40 w-full place-items-center rounded-card border-2 border-dashed border-line text-muted hover:border-brand/50 hover:text-brand-ink ${focusRing}`}><span className="flex items-center gap-2 font-semibold"><Plus className="size-5" aria-hidden="true" />New workout</span></button></li>`.
  - `remove.onSuccess` additionally calls `toast(`Deleted ${workout.name}`)`.
- [ ] **Step 3: NewWorkoutDialog / ExerciseSelection** — heading `text-xl font-bold`; `text-zinc-500` → `text-muted`; dashed empty hint `border-line`; picker list `divide-line border-line rounded-xl`; "Added" pill → `<Badge>`; library link `text-brand-ink hover:underline`; Add button `size="sm"` with `Plus` icon. Behaviour unchanged.
- [ ] **Step 4: Verify** — typecheck/tests/build; manual: card click opens editor, Start goes to timer, menu Edit/Delete work with keyboard, toast on delete.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): workouts as cards with last-done and menus"`

---

### Task 6: Workout editor and sortable entries

**Files:** Modify `web/src/workouts/WorkoutDetailPage.tsx`, `web/src/workouts/SortableExerciseList.tsx`, `web/src/workouts/AddExercisesDialog.tsx`

- [ ] **Step 1: Header card** (`WorkoutDetail`):
  - Back link: `Link` with `ArrowLeft` icon, `text-sm font-medium text-muted hover:text-ink`, text "All workouts".
  - `<Card className="mb-6">` containing either `RenameForm` or: `h1` (`text-3xl font-bold`), badges (exercise count, total time with `data-testid="total-time"` moved onto the total-time Badge's wrapper span: `<span data-testid="total-time"><Badge icon={Clock}>Total run time: {…}</Badge></span>`), and actions `RunLink`, `Button variant="ghost" icon={Pencil}` "Rename" (keeps `renameButtonRef`), `Menu label={`More actions for ${workout.name}`}` with Delete.
  - Rest control row inside the card under a `border-t border-line pt-4 mt-4`: `Timer` icon + "Rest between exercises" label + `InlineSeconds` (unchanged props).
- [ ] **Step 2: Entries section** — heading row with `Button variant="primary" icon={Plus}` "Add exercises"; empty → `EmptyState icon={ListChecks} title="No exercises yet"` with action button "Add exercises". `removeEntry.onSuccess` adds `toast('Exercise removed')`.
- [ ] **Step 3: SortableExerciseList** — `<ol className="space-y-2">`; `li` classes `relative flex items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-xs` plus dragging `z-10 shadow-lg ring-2 ring-brand/40`; grip button content → `<GripVertical className="size-4" />` with `text-muted hover:bg-sunken` and `focusRing`; index `text-muted`; description `text-muted`; reset ↺ → `RotateCcw` icon in an equivalent small button (same aria-label/title); Remove → `IconButton icon={X} variant="ghostDanger" label={`Remove ${item.name}`} disabled={removing}`.
- [ ] **Step 4: AddExercisesDialog** — on success `toast(`Added ${n} exercise${n === 1 ? '' : 's'}`)`; heading `text-xl font-bold`.
- [ ] **Step 5: Verify** — typecheck/tests/build; manual: drag with mouse and keyboard, override/reset duration, rename (Escape cancels, focus returns), delete via menu.
- [ ] **Step 6: Commit** — `git commit -am "feat(web): restyle workout editor"`

---

### Task 7: Run page with progress ring and celebration

**Files:** Create `web/src/run/ProgressRing.tsx`; modify `web/src/run/RunWorkoutPage.tsx`

**Produces:** `ProgressRing({ progress: number; kind: 'work' | 'rest'; children: ReactNode; label: string })` — `progress` in [0, 1].

- [ ] **Step 1: ProgressRing**

```tsx
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
```

- [ ] **Step 2: Header** — `PageHeader`-like row: left `<p className="text-xs font-semibold tracking-wider text-muted uppercase">Running</p>` + `h1` name; right `Badge tone="neutral"` "Exercise n of N" (hidden when done) and `IconButton icon={muted ? VolumeX : Volume2} label="Mute sound" aria-pressed={muted} onClick={toggleMute}`.
- [ ] **Step 3: Current step** — `<Card as="section" aria-label="Current step" className="text-center">`:
  - `<ProgressRing progress={progress} kind={isWork ? 'work' : 'rest'} label={`${isWork ? 'Exercise' : 'Rest'} progress`}>` containing the phase label (`data-testid="phase-label"`, `text-xs font-bold tracking-widest uppercase`, `text-brand-ink` for work / `text-rest` for rest, text `{label}` — and a separate "Paused" line `text-amber-700 dark:text-amber-400` when paused) and the countdown `<p role="timer" aria-label=… data-testid="countdown" className="font-display text-7xl leading-none font-bold tabular-nums sm:text-8xl">`.
  - Below the ring: rest shows "Up next" (muted) above the name; work shows the name (`text-3xl font-bold`, `data-testid="current-name"`) and description; then the existing "Then … rest, up next: …" / "Last exercise" line (`text-muted`).
  - Remove the old bar progressbar (the ring is the progressbar now).
- [ ] **Step 4: Controls** — `Button icon={SkipBack}` "Back", primary `icon={running ? Pause : Play}` "Pause"/"Resume" with `className="min-w-32"`, `Button icon={SkipForward}` "Skip" (icon after text is fine either way), `Button variant="ghostDanger" icon={Square}` "End workout". Keep `aria-keyshortcuts` and `title`s. Then a segment bar: `<div className="mt-5 flex justify-center gap-1" aria-hidden="true">{entries.map((e, i) => <span key={e.id} className={'h-1.5 w-8 rounded-full ' + (i < phase.entryIndex ? 'bg-brand' : i === phase.entryIndex ? (isWork ? 'bg-orange-300 dark:bg-orange-700' : 'bg-line') : 'bg-line')} />)}</div>`. Hint line `text-muted`.
- [ ] **Step 5: Complete state** — in `RunSession` add:

```ts
const tz = useMemo(localTimeZone, []);
const daysQuery = useQuery({ queryKey: runKeys.days(tz), queryFn: () => listRunDays(tz) });
```

  and render a celebration card: `<Card as="section" aria-live="polite" className="bg-linear-to-br from-orange-50 to-amber-50 text-center dark:from-orange-950/40 dark:to-stone-900">` with a `PartyPopper` icon in a gradient circle, `h2` "Workout complete" (`text-3xl font-bold`), summary line, `SaveStatus`, and when `save.data && daysQuery.data`: `const streak = streakStats(new Set([...daysQuery.data, dayKey(new Date(save.data.completedAt))]), new Date()).current;` → `<p className="mt-3 font-display text-2xl font-bold">{streak >= 2 ? `🔥 ${streak}-day streak` : 'Day 1 of a new streak'}</p>`. Buttons unchanged ("Run again" autofocus primary with `RotateCcw`, "Back to workout" secondary). `SaveStatus` link class → `font-semibold text-brand-ink hover:underline`; error text `text-red-700 dark:text-red-400`.
- [ ] **Step 6: EntryList & empty state** — `EntryList` inside a `Card padding="sm"` with `divide-line`; status colours: done `text-muted line-through decoration-muted/50` + `Check` icon, current `font-semibold` + `Badge` "Now", next `Badge tone="neutral"` "Next". No-exercises state → `EmptyState icon={ListChecks} title="Nothing to run yet"` with "Back to workout" link.
- [ ] **Step 7: Verify** — typecheck/tests/build; manual: Space/←/→ shortcuts, pause shows "Paused", rest turns ring teal, finishing shows streak, run saved appears on Progress.
- [ ] **Step 8: Commit** — `git add -A web && git commit -m "feat(web): timer ring and celebration screen"`

---

### Task 8: Exercises page, search, toasts, cleanup

**Files:** Modify `web/src/exercises/ExerciseLibrary.tsx`, `web/src/exercises/ExerciseList.tsx`, `web/src/exercises/ExerciseRow.tsx`, `web/src/exercises/AddExerciseDialog.tsx`, `web/src/components/ui.tsx` (remove `AddButton`), `README.md`

- [ ] **Step 1: Library header** — `PageHeader title="Exercise library" subtitle="The moves you build workouts from." action={<Button variant="primary" icon={Plus} onClick={…}>New exercise</Button>}`.
- [ ] **Step 2: Search + list** (`ExerciseList`): add `const [search, setSearch] = useState('')`; when `exercises.length > 0` render

```tsx
<div className="relative mb-4">
  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
  <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={search}
    onChange={(e) => setSearch(e.target.value)} className={inputClass + ' pl-9'} />
</div>
```

  and render `filterByName(exercises, search)`; if empty with a non-blank search: `<p className="py-6 text-center text-muted" role="status">No exercises match “{search.trim()}”.</p>`. List: `<ul className="space-y-2">`. Library empty: `EmptyState icon={ListChecks} title="No exercises yet"` (body: "Add the moves you do, like Plank or Squats, with how long each one runs.").
  - Delete success → `toast(`Deleted ${exercise.name}`)`.
- [ ] **Step 3: Rows** — `ExerciseRowView` root `<Card as="li" padding="sm" className="flex items-start gap-4">`; name `font-semibold`; duration → `<span data-testid="exercise-duration"><Badge icon={Clock}>{…}</Badge></span>`; description `text-muted`; Edit → `Button variant="ghost" size="sm" icon={Pencil}` (keep ref + aria-label); Delete → `Button variant="ghostDanger" size="sm" icon={Trash2}` (keep aria-label/deleting text). `ExerciseRowEdit` root `<Card as="li" padding="sm">`; on success `toast('Exercise saved')`.
- [ ] **Step 4: AddExerciseDialog** — heading `text-xl font-bold`; `(required)` / `(optional)` hints `text-muted`; on success `toast(`Added ${name.trim()}`)`.
- [ ] **Step 5: Cleanup** — remove `AddButton` from `ui.tsx`; `grep -rn "zinc-\|indigo-" web/src` and replace leftovers using: `text-zinc-500`/`text-zinc-400` → `text-muted`; `text-zinc-600 dark:text-zinc-300|400` → `text-muted`; `divide-zinc-200 dark:divide-zinc-800` → `divide-line`; `border-zinc-*` → `border-line`; `bg-zinc-200|100 … hover` → `bg-sunken`; `indigo-*` focus → `brand`; `text-indigo-600 dark:text-indigo-400` links → `text-brand-ink`. Expected after: no matches.
- [ ] **Step 6: README** — in "Pages", mention the sidebar with "Start workout" picker, workout cards with last done, exercise search; replace "amber/orange" heat wording only if changed (it isn't).
- [ ] **Step 7: Final verification** — from repo root: `npm test && npm run typecheck && npm run build`. Manual pass (light + dark, 1280px + 375px, keyboard only) over every page per the spec's Testing section.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat(web): restyle exercises, add search and toasts"`
