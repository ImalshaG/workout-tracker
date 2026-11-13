# Workout Tracker

Local, single-user workout app: an exercise library, workouts built from those exercises, a timer to run them,
and a calendar of completed runs.

## Run

```sh
npm install
npm run dev        # migrations, then API on :3001 + UI on http://localhost:5173
```

Production-style: `npm run build && npm start` → http://localhost:3001

## Scripts

| Script | What it does |
| --- | --- |
| `dev` | Apply migrations, then API (`tsx watch`) + Vite together |
| `test` | Vitest: API tests (fresh in-memory SQLite per test) and web unit tests (timer, calendar dates, streaks) |
| `typecheck` | `tsc --noEmit` for server and web (strict) |
| `build` / `start` | Compile both; API serves the built UI |
| `db:generate` | Generate a migration from `server/src/db/schema.ts` |
| `db:migrate` | Apply migrations to `server/data/workouts.db` |

## Pages

A left sidebar (a top bar on narrow screens) links the pages below. Its **Start workout** button opens a picker of your
workouts, most recently done first, that jumps straight to the timer.

- `/` (home): **Your progress**, a compact month view marking days with a completed workout. Colour shows streaks
  as heat: amber for day 1, deeper for day 2, orange for day 3+ in a row (current and longest streak shown above). Pick a day to see its runs below (time,
  duration, exercises) or remove one. `?month=YYYY-MM&day=YYYY-MM-DD` keeps your place. Arrow keys move between
  days, Page Up/Down change month. (Old `/calendar` links redirect here.)
- `/workouts`: workouts as cards (exercise count, total time, when you last did it, Start); **New workout** creates one
  (name + exercises picked from the library). Edit and Delete are in each card's ⋯ menu.
- `/workouts/:id`: rename/delete the workout; add, remove and drag to reorder its exercises; set the rest between
  exercises and override any exercise's duration for this workout (↺ resets it to the exercise default).
- `/workouts/:id/run`: runs the workout: each exercise for its duration, with the workout's rest between. Pause/resume (Space),
  skip (→), back (←), end. Beeps for the last 3s and on each change (can be muted); keeps the screen awake while running.
  Completed runs are saved to Your progress (ending early isn't).
- `/exercises`: the exercise library with a search box; each exercise has a default duration (30s unless changed).

## API

| Method & path | Notes |
| --- | --- |
| `GET/POST /api/exercises`, `PUT/DELETE /api/exercises/:id` | `{ name, description?, durationSeconds? }` (1–3600, default 30). Delete returns `409 EXERCISE_IN_USE` if a workout uses it |
| `GET /api/workouts` | Summaries with `exerciseCount`, `restSeconds`, `totalSeconds`, sorted by name |
| `POST /api/workouts` | `{ name, restSeconds?, exerciseIds? }`: rest 0–600 (default 10); ordered, repeats allowed. Each `exerciseIds` item is an id or `{ exerciseId, durationSeconds }` to override that entry |
| `GET/PUT/DELETE /api/workouts/:id` | `PUT { name, restSeconds? }` (rest unchanged if omitted). Entries include `durationSeconds` (effective), `overrideSeconds`, `defaultSeconds` |
| `POST /api/workouts/:id/exercises` | `{ exerciseIds }` (same item forms), appended to the end |
| `PATCH /api/workouts/:id/exercises/:entryId` | `{ durationSeconds }` sets an entry's override; `null` clears it |
| `DELETE /api/workouts/:id/exercises/:entryId` | Removes one occurrence |
| `PUT /api/workouts/:id/exercises/order` | `{ entryIds }`, must be exactly the current entries, else `409 ORDER_MISMATCH` |
| `GET /api/runs?from=&to=` | Completed runs with `completedAt` in `[from, to)` (Unix ms), oldest first |
| `POST /api/runs` | `{ workoutId, startedAt }`, recorded as completed now, with a snapshot of the workout's name and exercises |
| `GET /api/runs/days?tz=Area/City` | Distinct days (in that IANA time zone) with a completed run, for streaks |
| `DELETE /api/runs/:id` | Removes a history entry |

Each exercise occurrence in a workout is an *entry* with its own id, so the same exercise can appear more than once
and each occurrence can be moved or removed on its own.

Runs keep a snapshot of what was done, so history isn't changed by later renames/edits. Deleting a workout keeps
its runs (their `workoutId` becomes `null`).

## Layout

- `server/`: Hono API, Drizzle schema in `src/db/schema.ts`, committed migrations in `drizzle/`, routes in `src/routes/`.
  `createApp({ db, now })` is the app factory used by both the server and the tests.
- `web/`: React + Vite + Tailwind + TanStack Query + React Router; drag and drop via dnd-kit, icons from lucide-react,
  fonts (Outfit, Barlow Condensed) bundled via Fontsource. Design tokens (colours, fonts, radii, shadows) are in
  `src/index.css`; shared UI (buttons, cards, badges, menu, toasts) in `src/components/`. `src/api/` wraps the
  typed `hc<AppType>` client (it imports only the `AppType` type from `server/src/app.ts`); features live in
  `src/progress/`, `src/workouts/`, `src/run/` and `src/exercises/`, shared UI in `src/components/`.

The database lives in `server/data/workouts.db` (git-ignored, created on first run). The server also applies
pending migrations on startup.

## Environment

- `PORT` (API, default 3001) and `DB_PATH` (default `server/data/workouts.db`) for the server.
- `API_PORT` tells Vite's dev proxy where the API is (default 3001).

## Notes

- Name uniqueness ignores case via `COLLATE NOCASE` on the column plus a unique index; the API maps the SQLite
  unique-constraint error to `409 NAME_TAKEN`. `NOCASE` folds ASCII letters only.
- Native/install scripts are disabled in `package.json` (`allowScripts`): `better-sqlite3` ships prebuilt
  binaries and esbuild uses its platform package, so neither needs a build step.
