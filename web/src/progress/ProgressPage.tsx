import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { ApiRequestError, errorFor } from '../api/client';
import { deleteRun, listRunDays, listRuns, localTimeZone, runKeys, type Run } from '../api/runs';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Menu } from '../components/Menu';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, IconButton, LoadError, PageHeader, StatCard } from '../components/ui';
import { formatShortDuration } from '../time';
import { usePageTitle } from '../usePageTitle';
import {
  addDays,
  addMonths,
  dayKey,
  formatDuration,
  groupByDay,
  inMonth,
  localeWeekStart,
  monthKey,
  monthOf,
  monthWeeks,
  parseDayKey,
  parseMonthKey,
  sameDay,
  shiftMonthClamped,
  startOfWeek,
  type Month,
} from './dates';
import { heatLevel, streakLength, streakPosition, streakStats, type HeatLevel } from './streaks';

export function ProgressPage() {
  usePageTitle('Your progress');
  const [params, setParams] = useSearchParams();
  const today = new Date();

  // URL holds the visible month and selected day, so reloads and links keep your place.
  const selected = parseDayKey(params.get('day'));
  const month = monthFromParams(params);
  const weekStart = useMemo(() => localeWeekStart(), []);
  const weeks = useMemo(() => monthWeeks(month, weekStart), [month.year, month.month, weekStart]);
  const from = weeks[0]![0]!.getTime();
  const to = addDays(weeks.at(-1)!.at(-1)!, 1).getTime();

  const query = useQuery({
    queryKey: runKeys.range(from, to),
    queryFn: () => listRuns(from, to),
    placeholderData: keepPreviousData,
  });
  const byDay = useMemo(() => groupByDay(query.data ?? [], (r) => r.completedAt), [query.data]);

  // All days with a workout (not just this month), for streaks that cross month boundaries.
  const tz = useMemo(localTimeZone, []);
  const daysQuery = useQuery({ queryKey: runKeys.days(tz), queryFn: () => listRunDays(tz) });
  const doneDays = useMemo(() => new Set([...(daysQuery.data ?? []), ...byDay.keys()]), [daysQuery.data, byDay]);
  const isDone = (d: Date) => doneDays.has(dayKey(d));
  const streaks = streakStats(doneDays, today);

  const toParams = (m: Month, day?: Date | null) => {
    const p = new URLSearchParams();
    p.set('month', monthKey(m));
    if (day) p.set('day', dayKey(day));
    return p;
  };
  // Router navigations render as transitions: the address bar updates at once, but this component (and
  // the router's `prev` params) can lag behind. Relative steps read the real current URL so quick
  // repeated clicks or key presses each move one step instead of being lost.
  const currentParams = () => new URLSearchParams(window.location.search);
  const shiftMonth = (n: number) => setParams(toParams(addMonths(monthFromParams(currentParams()), n)));
  const selectDay = (d: Date, replace = false) => setParams(toParams(monthOf(d), d), { replace });
  const moveSelection = (step: (d: Date) => Date) => {
    const now = currentParams();
    const next = step(focusDayFor(monthFromParams(now), parseDayKey(now.get('day'))));
    setParams(toParams(monthOf(next), next), { replace: true });
  };

  // Which cell is in the tab order: the selected day, else today, else the 1st.
  const focusDay = focusDayFor(month, selected);
  const gridRef = useRef<HTMLTableElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-day="${dayKey(focusDay)}"]`)?.focus();
  });

  function onGridKeyDown(e: KeyboardEvent) {
    const steps: Record<string, (d: Date) => Date> = {
      ArrowLeft: (d) => addDays(d, -1),
      ArrowRight: (d) => addDays(d, 1),
      ArrowUp: (d) => addDays(d, -7),
      ArrowDown: (d) => addDays(d, 7),
      Home: (d) => startOfWeek(d, weekStart),
      End: (d) => addDays(startOfWeek(d, weekStart), 6),
      PageUp: (d) => shiftMonthClamped(d, -1),
      PageDown: (d) => shiftMonthClamped(d, 1),
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    moveFocus.current = true;
    moveSelection(step);
  }

  const monthRuns = (query.data ?? []).filter((r) => inMonth(new Date(r.completedAt), month));
  const activeDays = new Set(monthRuns.map((r) => dayKey(new Date(r.completedAt)))).size;
  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdayNames = weeks[0]!.map((d) => ({
    short: d.toLocaleDateString(undefined, { weekday: 'short' }),
    long: d.toLocaleDateString(undefined, { weekday: 'long' }),
  }));

  return (
    <>
      <PageHeader title="Your progress" subtitle="Every day you train keeps the flame alive." />

      {query.isError && !query.data ? (
        <LoadError what="your workout history" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Current streak"
              value={streaks.current > 0 ? `${streaks.current >= 2 ? '🔥 ' : ''}${days(streaks.current)}` : '—'}
              note={streaks.current > 0 && !streaks.doneToday ? 'Train today to keep it going' : undefined}
              highlight={streaks.current >= 2}
              testId="current-streak"
            />
            <StatCard label="Longest streak" value={streaks.longest > 0 ? days(streaks.longest) : '—'} testId="longest-streak" />
            <StatCard
              label="This month"
              value={query.isPending ? '…' : `${monthRuns.length} workout${monthRuns.length === 1 ? '' : 's'}`}
              note={query.isPending || monthRuns.length === 0 ? undefined : `on ${days(activeDays)}`}
              testId="month-summary"
            />
          </dl>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card padding="sm" className="sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shiftMonth(-1)} />
                <h2 className="text-center text-lg font-semibold" aria-live="polite">
                  {monthLabel}
                </h2>
                <div className="flex items-center gap-1">
                  <Button size="sm" onClick={() => selectDay(today)} disabled={selected !== null && sameDay(selected, today)}>
                    Today
                  </Button>
                  <IconButton icon={ChevronRight} label="Next month" onClick={() => shiftMonth(1)} />
                </div>
              </div>

              <table
                ref={gridRef}
                className="w-full table-fixed border-separate border-spacing-y-1"
                aria-label={`Workouts in ${monthLabel}`}
                onKeyDown={onGridKeyDown}
              >
                <thead>
                  <tr>
                    {weekdayNames.map((n) => (
                      <th key={n.long} scope="col" className="pb-1 text-xs font-semibold text-muted">
                        <abbr title={n.long} className="no-underline">
                          {n.short}
                        </abbr>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={dayKey(week[0]!)}>
                      {week.map((day) => (
                        <DayCell
                          key={dayKey(day)}
                          day={day}
                          runCount={byDay.get(dayKey(day))?.length ?? (isDone(day) ? 1 : 0)}
                          // Colour deepens the further into a streak a day is.
                          position={streakPosition(doneDays, day)}
                          streakLength={streakLength(doneDays, day)}
                          // Neighbouring workout days are joined by a band so a streak reads as one run.
                          joinPrev={isDone(day) && isDone(addDays(day, -1))}
                          joinNext={isDone(day) && isDone(addDays(day, 1))}
                          outside={!inMonth(day, month)}
                          isToday={sameDay(day, today)}
                          isSelected={selected !== null && sameDay(day, selected)}
                          tabbable={sameDay(day, focusDay)}
                          onSelect={() => selectDay(day)}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted" data-testid="heat-legend">
                <span>Streak day</span>
                {([1, 2, 3] as const).map((level) => (
                  <span key={level} className="inline-flex items-center gap-1">
                    <span className={'inline-block size-3.5 rounded-full ' + HEAT_CLASSES[level]} aria-hidden="true" />
                    {level === 3 ? '3+' : level}
                  </span>
                ))}
                <span className="ml-1">· deeper colour = longer streak</span>
              </div>
              <p className="mt-1 text-xs text-muted">Arrow keys move between days · Page Up/Down change month</p>
            </Card>

            <div>
              {selected ? (
                <DayDetails day={selected} runs={byDay.get(dayKey(selected)) ?? []} loading={query.isPending} />
              ) : (
                <EmptyState icon={CalendarDays} title="Pick a day">
                  See the workouts you finished on any day.
                </EmptyState>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function monthFromParams(params: URLSearchParams): Month {
  const selected = parseDayKey(params.get('day'));
  return parseMonthKey(params.get('month')) ?? monthOf(selected ?? new Date());
}

/** The day that holds keyboard focus in a month: the selected day, else today, else the 1st. */
function focusDayFor(month: Month, selected: Date | null): Date {
  const today = new Date();
  if (selected && inMonth(selected, month)) return selected;
  if (inMonth(today, month)) return today;
  return new Date(month.year, month.month, 1);
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** Fill + text colour per heat level (day 1, 2, 3+ of a streak), readable in light and dark mode. */
const HEAT_CLASSES: Record<Exclude<HeatLevel, 0>, string> = {
  1: 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100',
  2: 'bg-amber-400 text-amber-950 dark:bg-amber-600 dark:text-white',
  3: 'bg-orange-600 text-white dark:bg-orange-500 dark:text-white',
};

/** Half-cell band behind the day circles, joining consecutive workout days (continues past row edges). */
const STREAK_BAND = 'absolute top-1/2 h-4 -translate-y-1/2 bg-amber-200 dark:bg-amber-900/70';

function DayCell({
  day,
  runCount,
  position,
  streakLength,
  joinPrev,
  joinNext,
  outside,
  isToday,
  isSelected,
  tabbable,
  onSelect,
}: {
  day: Date;
  runCount: number;
  /** 1-based day within its streak (1 = first or lone workout day); 0 = no workout. */
  position: number;
  streakLength: number;
  /** Whether this and the previous / next day both have workouts (draws the connecting band). */
  joinPrev: boolean;
  joinNext: boolean;
  outside: boolean;
  isToday: boolean;
  isSelected: boolean;
  tabbable: boolean;
  onSelect: () => void;
}) {
  const done = position > 0;
  const heat = heatLevel(position);
  // Today, done, and continuing from yesterday: today is on a live streak.
  const onFire = isToday && position >= 2;
  const fullDate = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const label =
    `${fullDate}${isToday ? ', today' : ''}, ` +
    (done ? `${runCount} workout${runCount === 1 ? '' : 's'}` : 'no workouts') +
    (streakLength >= 2 ? `, day ${position} of a ${streakLength}-day streak` : '');

  return (
    <td className="p-0">
      <button
        type="button"
        data-day={dayKey(day)}
        data-done={done || undefined}
        data-streak={streakLength >= 2 || undefined}
        data-heat={heat || undefined}
        data-on-fire={onFire || undefined}
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-pressed={isSelected}
        aria-current={isToday ? 'date' : undefined}
        onClick={onSelect}
        className={'group relative grid h-10 w-full place-items-center focus-visible:outline-none ' + (outside ? 'opacity-40' : '')}
      >
        {joinPrev && <span className={STREAK_BAND + ' left-0 right-1/2'} aria-hidden="true" />}
        {joinNext && <span className={STREAK_BAND + ' left-1/2 right-0'} aria-hidden="true" />}
        <span
          className={
            'relative grid size-8 place-items-center rounded-full text-sm tabular-nums group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-brand ' +
            (heat
              ? HEAT_CLASSES[heat] + ' font-semibold group-hover:brightness-110 '
              : 'group-hover:bg-sunken ') +
            (isToday && !done ? 'font-bold text-brand-ink ' : '') +
            (isSelected ? 'ring-2 ring-brand ring-offset-2 ring-offset-surface ' : '')
          }
        >
          {onFire ? (
            <span className="text-base leading-none" aria-hidden="true" title={`Day ${position} of your streak`}>
              🔥
            </span>
          ) : (
            day.getDate()
          )}
          {runCount > 1 && (
            <span className="absolute -top-1 -right-1.5 rounded-full bg-ink px-1 text-[9px] leading-3.5 font-semibold text-canvas">
              ×{runCount}
            </span>
          )}
        </span>
        {isToday && <span className="absolute bottom-0 size-1 rounded-full bg-brand" aria-hidden="true" />}
      </button>
    </td>
  );
}

function DayDetails({ day, runs, loading }: { day: Date; runs: Run[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState<Run | null>(null);
  const remove = useMutation({
    mutationFn: async (run: Run) => {
      try {
        await deleteRun(run.id);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return; // already gone
        throw err;
      }
    },
    onSuccess: () => {
      setConfirming(null);
      toast('Removed from your history');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: runKeys.all }),
  });
  const deleteError = errorFor(remove.error)?.message;
  const heading = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <section aria-labelledby="day-heading">
      <h2 id="day-heading" className="text-lg font-semibold">
        {heading}
      </h2>
      {loading ? null : runs.length === 0 ? (
        <p className="mt-2 rounded-card border border-dashed border-line px-4 py-6 text-center text-muted">No workouts on this day.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {runs.map((run) => (
            <Card as="li" padding="sm" key={run.id} className="flex items-start gap-3" data-testid="day-run">
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words">
                  {run.workoutId ? (
                    <Link to={`/workouts/${run.workoutId}`} className="hover:text-brand-ink hover:underline">
                      {run.workoutName}
                    </Link>
                  ) : (
                    <>
                      {run.workoutName} <span className="text-xs font-normal text-muted">(deleted)</span>
                    </>
                  )}
                </p>
                <p className="text-sm text-muted">
                  Finished {time(run.completedAt)} · took {formatDuration(run.completedAt - run.startedAt)} ·{' '}
                  {run.exercises.length} exercise{run.exercises.length === 1 ? '' : 's'}
                </p>
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-muted hover:text-ink">Exercises</summary>
                  <ol className="mt-1 list-decimal pl-6 text-muted">
                    {run.exercises.map((e, i) => (
                      <li key={i}>
                        {e.name}
                        {e.durationSeconds !== undefined && (
                          <span className="tabular-nums"> · {formatShortDuration(e.durationSeconds)}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
              <Menu
                className="-mt-1 -mr-1"
                label={`Actions for ${run.workoutName} at ${time(run.completedAt)}`}
                items={[
                  {
                    label: 'Remove from history',
                    icon: Trash2,
                    danger: true,
                    onSelect: () => {
                      remove.reset();
                      setConfirming(run);
                    },
                  },
                ]}
              />
            </Card>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirming !== null}
        message={
          !confirming
            ? ''
            : deleteError
              ? `Couldn't remove this entry: ${deleteError}`
              : `Remove ${confirming.workoutName} (${time(confirming.completedAt)}) from your history? This can't be undone.`
        }
        confirmLabel={deleteError ? 'Try again' : 'Remove'}
        pendingLabel="Removing…"
        pending={remove.isPending}
        onConfirm={() => confirming && remove.mutate(confirming)}
        onCancel={() => {
          setConfirming(null);
          remove.reset();
        }}
      />
    </section>
  );
}
