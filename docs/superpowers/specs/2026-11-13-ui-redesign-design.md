# UI redesign: warm, energetic, desktop-first

Date: 2026-11-13
Status: approved in brainstorming, awaiting spec review

## Goal

Make the web app (`web/`) more attractive and easier to use. Primary use is on a desktop browser.
Scope is a full restyle plus UX polish. No API or database changes.

## Decisions

| Topic | Decision |
| --- | --- |
| Device | Desktop first. Must still work down to ~375px wide (sidebar collapses, see Shell). |
| Visual direction | Warm and energetic: orange→amber accent, white cards with soft warm shadows, bold numbers. |
| Approach | Design tokens in Tailwind v4 `@theme` + a small shared component kit. No component library. |
| Navigation | Left sidebar (logo, icon + label links, "Start workout" button). |
| Icons | `lucide-react` (new dependency). |
| Fonts | Outfit (UI) and Barlow Condensed (numbers), bundled via `@fontsource/*` so the app works offline. |
| App name | "Workout Tracker" (already used by `usePageTitle`). `index.html` title changes from "Exercise Library". |
| Dark mode | Kept, still following the OS setting (`prefers-color-scheme`). Warm stone surfaces instead of zinc. |

## Non-goals

- New features needing the API (charts, stats endpoints, filters on the server).
- A theme toggle, mobile bottom-tab layout, PWA/offline caching.
- Changing behaviour of the timer, calendar keyboard navigation or the modal's focus handling.

## Design tokens (`web/src/index.css`)

Defined with `@theme` so they become Tailwind utilities (`bg-surface`, `text-muted`, `font-display`, …):

- **Colours:** `brand` (orange-500 `#f97316`), `brand-2` (amber-500 `#f59e0b`), `brand-soft` (orange-100),
  `bg` (warm off-white `#fffaf5`), `surface` (white), `line` (`#f1e4d6`), `ink`, `muted`; `rest` (teal) for rest
  phases; `danger` (red). Each has a dark-mode value set under `@media (prefers-color-scheme: dark)` by overriding
  the CSS variables (surfaces become stone-900/950, lines stone-800, brand stays orange).
- **Fonts:** `--font-sans: Outfit`, `--font-display: "Barlow Condensed"` (used with `tabular-nums` for stats and
  the countdown).
- **Shape:** card radius 14px, button radius 10px; shadows `shadow-card` (soft warm two-layer) and `shadow-brand`
  (orange glow for primary buttons).
- **Primary gradient:** `bg-linear-135 from-brand to-brand-2`, exposed through the Button component rather than
  repeated in pages.

Existing streak heat colours (amber-200 / amber-400 / orange-600) and the streak band stay as they are; they
already fit the palette.

## Component kit (`web/src/components/`)

`ui.tsx` is split up as it grows; each component keeps today's accessibility behaviour.

| Component | Notes |
| --- | --- |
| `Button` / `buttonClass` | Variants: `primary` (gradient + glow), `secondary` (surface + line border), `ghost`, `danger`, `ghostDanger`. Optional `icon` prop (lucide component) rendered before the label. Sizes `sm` / `md`. |
| `IconButton` | Square ghost button with required `label` (used as `aria-label` and `title`). Replaces `AddButton`. |
| `Card` | `section`/`div` with surface, line border, radius, `shadow-card`; `padding` prop. |
| `Badge` | Small pill on `brand-soft`, optional icon. Used for exercise counts and durations. |
| `StatCard` | Label (small caps) + big display-font value + optional note; `highlight` adds the warm gradient. Replaces `Stat` in `ProgressPage`. |
| `EmptyState` | Icon, one line of text, optional primary action. |
| `Menu` | "⋯" overflow menu: button with `aria-haspopup="menu"`, `role="menu"` list, arrow keys / Escape / click-outside close, focus returns to the button. |
| `Toast` + `useToast` | Context provider in `main.tsx`; `toast("Workout deleted")`. Bottom-right, `role="status"`, auto-dismiss after 4s, max 3 stacked. |
| `PageHeader` | Title + optional subtitle + action slot, restyled. |
| `Modal` / `ConfirmDialog` | Same `<dialog>` logic. Restyle only: radius 16px, `backdrop:backdrop-blur-sm`, title row with optional icon. |
| `StatusLine`, `LoadError`, `FieldError`, `SecondsInput` | Restyled only; inputs get the new radius, `line` border and brand focus ring. |

## Shell (`Layout.tsx`)

- Two-column layout: fixed-width sidebar (~220px) + main column (content max-width ~880px, centred).
- Sidebar: logo mark (gradient square with flame icon) + "Workout Tracker"; nav links Progress (`CalendarDays`),
  Workouts (`Dumbbell`), Exercises (`ListChecks`) with active state on `brand-soft`; "Start workout" primary button
  below the links.
- Under 768px the sidebar becomes a top bar: logo, icon-only nav links (with `aria-label`), Start button as an icon.
- The run page (`/workouts/:id/run`) keeps the sidebar visible; no layout special case.

### Start workout picker

- Sidebar button opens a `Modal` listing workouts with at least one exercise, most recently run first (then by
  name). Each row: name, badges (count, total time), whole row is a link to `/workouts/:id/run`.
- Data: `listWorkouts()` plus `listRuns()` with no range (the API already allows omitting `from`/`to`), reduced
  client-side to last `completedAt` per `workoutId`. Shared helper `lastRunByWorkout(runs)` in
  `web/src/workouts/lastRun.ts` with unit tests.
- Empty: `EmptyState` "No workouts to start yet" → link to `/workouts`.

## Pages

### Progress (`/`)

- `PageHeader` "Your progress"; month switcher and Today button move into the calendar card's header row.
- Three `StatCard`s in a row (current streak highlighted when ≥ 2 days, longest, this month).
- Calendar inside a `Card`. Grid, heat colours, streak bands, today's flame and keyboard behaviour unchanged.
- Desktop (≥ 1024px): calendar card and selected-day details side by side (calendar ~60%). Narrower: stacked.
- Day details: each run is a small card with time, duration, exercise count, collapsible exercise list, and a
  `Menu` with "Remove from history". Removing shows a toast.

### Workouts (`/workouts`)

- Header action: primary "New workout" button with `Plus` icon (replaces the round `AddButton`).
- Two-column card grid (one column under 640px). Card: name (link to editor, whole card clickable via the title
  link stretched over the card), badges (exercise count, total time), "Last done: yesterday / 5 Nov / never",
  full-width primary "Start" (disabled with title "Add exercises to run this workout" when empty), `Menu` with
  Edit and Delete.
- Last card is a dashed "+ New workout" tile.
- Delete confirm unchanged; success shows a toast.
- "Last done" uses the same `lastRunByWorkout` helper and query as the picker (`runKeys.all`-based key, so
  completing or removing a run refreshes it).

### Workout editor (`/workouts/:id`)

- Back link with `ArrowLeft` icon. Header card: name, badges, actions (Start primary, Rename ghost, `Menu` → Delete).
- Rest-between-exercises control sits in the header card.
- Entries: each a card row with a `GripVertical` drag handle (dnd-kit unchanged), index, name, duration pill
  (override shown in brand colour with the existing ↺ reset), remove `IconButton` (`X`).
- "Add exercises" opens the existing dialog, restyled. Saves that already show inline errors keep doing so;
  successful remove/add shows a toast.

### Run (`/workouts/:id/run`)

- Header: "Running" label + workout name; right side "Exercise n of N" and the sound toggle as an `IconButton`
  (`Volume2` / `VolumeX`, `aria-pressed` kept).
- Countdown inside an SVG progress ring (~240px): brand gradient for work, `rest` teal for rest; phase label
  ("Work"/"Rest"/"Paused") above the time in display font (~72px).
- Exercise name and description below the ring; "Up next: name (duration)".
- Controls: Back, Pause/Resume (primary, wider), Skip with lucide icons; existing shortcuts and `aria-keyshortcuts`
  unchanged.
- Segment bar: one segment per entry (done = `brand`, current = orange-300, upcoming = `line`).
- Complete state: celebration `Card` with `PartyPopper` icon, summary, save status, and the current streak from
  `listRunDays` + `streakStats` (shown after the save succeeds); buttons Run again / Back to workout.
- The existing ordered entry list below stays, restyled.

### Exercises (`/exercises`)

- Header action: "New exercise" primary button.
- Search input with `Search` icon above the list; filters by name, case-insensitive, client-side. "No exercises
  match "x"" message when the filter hides everything.
- Each exercise is a card row: name, duration `Badge`, description (muted), Edit / Delete as today (inline edit
  form kept).

### Not found

- `EmptyState` with `SearchX` icon and a link back to Progress.

## Data flow

No new endpoints. New client queries:

- `runKeys.allRuns()` → `['runs', 'all']` calling `listRuns()` without bounds (`listRuns` gains optional
  `from`/`to`). Lives under `runKeys.all`, so existing invalidations refresh it.

## Error handling

- Load failures keep `LoadError` (restyled). Mutation errors keep their current inline/dialog messages.
- Toasts are only for success confirmations, never the sole place an error appears.
- If the all-runs query fails, "Last done" and picker ordering silently fall back (no "Last done" line, sort by
  name); the rest of the page still works.

## Accessibility (must not regress)

- All current ARIA labels, `aria-current`, `aria-pressed`, live regions and keyboard handling stay.
- Icon-only controls always have an accessible name. Decorative icons get `aria-hidden`.
- Text contrast ≥ 4.5:1 on both themes (white on the orange gradient uses bold text at ≥ 14px; check `brand` on
  `brand-soft` badges).
- Visible focus rings on every interactive element (brand-coloured outline).
- Respect `prefers-reduced-motion` for the ring animation and toasts.

## Testing

- Unit tests (Vitest) for new pure helpers: `lastRunByWorkout`, "last done" label formatting, exercise name filter.
- Existing tests (timer, dates, streaks, server) must keep passing; `npm run typecheck` and `npm run build` clean.
- Manual check in the browser, light and dark: each page, keyboard-only pass (calendar arrows, timer shortcuts,
  menus, dialogs), window at 1280px and 375px.

## Implementation order

1. Tokens, fonts, icons dependency; component kit; Layout with sidebar.
2. Progress page.
3. Workouts page + `lastRunByWorkout` + Start picker.
4. Workout editor.
5. Run page.
6. Exercises page + search, Not found, toasts wired into mutations.
