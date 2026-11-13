import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError, errorFor } from '../api/client';
import { listRunDays, localTimeZone, logRun, runKeys } from '../api/runs';
import { dayKey, monthKey, monthOf } from '../progress/dates';
import { getWorkout, workoutKeys, type Workout } from '../api/workouts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NotFound } from '../components/NotFound';
import { Check, ListChecks, PartyPopper, Pause, Play, RotateCcw, SkipBack, SkipForward, Square, Volume2, VolumeX } from 'lucide-react';
import { Badge, Button, buttonClass, Card, EmptyState, IconButton, LoadError, PageHeader, StatusLine } from '../components/ui';
import { streakStats } from '../progress/streaks';
import { ProgressRing } from './ProgressRing';
import { formatShortDuration } from '../time';
import { usePageTitle } from '../usePageTitle';
import {
  backTarget,
  buildPhases,
  displaySeconds,
  elapsedAt,
  formatSeconds,
  isRunning,
  locate,
  pauseClock,
  resumeClock,
  seekClock,
  skipTarget,
  startClock,
  totalDuration,
  type Clock,
} from './timeline';
import { useBeeper } from './useBeeper';
import { useWakeLock } from './useWakeLock';

const TICK_MS = 100;
const MUTE_KEY = 'run.muted';

export function RunWorkoutPage() {
  const { id } = useParams();
  if (!id || !/^[1-9]\d{0,15}$/.test(id)) return <NotFound title="Workout not found" backTo="/workouts" backLabel="Back to workouts" />;
  return <RunLoader key={id} id={Number(id)} />;
}

function RunLoader({ id }: { id: number }) {
  const query = useQuery({ queryKey: workoutKeys.detail(id), queryFn: () => getWorkout(id) });
  // Snapshot the workout when the run starts so background refetches can't reshuffle it mid-run.
  const [snapshot, setSnapshot] = useState<Workout | null>(null);
  const [runNumber, setRunNumber] = useState(1);
  useEffect(() => {
    if (query.data && !snapshot) setSnapshot(query.data);
  }, [query.data, snapshot]);
  usePageTitle(snapshot ? `Running ${snapshot.name}` : 'Run workout');

  if (snapshot) {
    if (snapshot.exercises.length === 0) {
      return (
        <>
          <PageHeader title={snapshot.name} />
          <EmptyState
            icon={ListChecks}
            title="Nothing to run yet"
            action={
              <Link to={`/workouts/${id}`} className={buttonClass('primary')}>
                Back to workout
              </Link>
            }
          >
            This workout has no exercises yet. Add some, then start it again.
          </EmptyState>
        </>
      );
    }
    return (
      <RunSession
        key={runNumber}
        workout={snapshot}
        onRunAgain={() => {
          setSnapshot(query.data ?? snapshot);
          setRunNumber((n) => n + 1);
        }}
      />
    );
  }
  if (query.isPending) return <StatusLine>Loading workout…</StatusLine>;
  if (query.error instanceof ApiRequestError && query.error.status === 404) {
    return <NotFound title="Workout not found" backTo="/workouts" backLabel="Back to workouts" />;
  }
  return <LoadError what="this workout" onRetry={() => query.refetch()} retrying={query.isFetching} />;
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function RunSession({ workout, onRunAgain }: { workout: Workout; onRunAgain: () => void }) {
  const navigate = useNavigate();
  const entries = workout.exercises;
  // Each exercise runs for its own duration (entry override or exercise default), with the workout's rest between.
  const phases = useMemo(
    () => buildPhases(entries.map((e) => e.durationSeconds * 1000), workout.restSeconds * 1000),
    [entries, workout.restSeconds],
  );

  const [clock, setClock] = useState<Clock>(() => startClock(performance.now()));
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => performance.now());
  const [confirmingEnd, setConfirmingEnd] = useState<{ wasRunning: boolean } | null>(null);
  const [muted, setMuted] = useState(readMuted);

  const running = isRunning(clock);
  const elapsed = elapsedAt(clock, now);
  const pos = locate(phases, elapsed);

  // Tick while running. Time comes from timestamps, so late ticks don't drift.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [running]);

  // Stop the clock when the last phase ends.
  useEffect(() => {
    if (pos.done && running) setClock((c) => pauseClock(c, performance.now()));
  }, [pos.done, running]);

  useWakeLock(running && !pos.done);

  // --- Record the run once it completes (ending early isn't recorded).
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => logRun(workout.id, startedAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKeys.all }),
  });
  // Mounted for the whole run so the post-save invalidation refreshes it in time for the celebration.
  const tz = useMemo(localTimeZone, []);
  const daysQuery = useQuery({ queryKey: runKeys.days(tz), queryFn: () => listRunDays(tz) });
  const saveRequested = useRef(false);
  useEffect(() => {
    if (pos.done && !saveRequested.current) {
      saveRequested.current = true;
      save.mutate();
    }
  }, [pos.done, save]);

  // --- Sound cues
  const beep = useBeeper(muted);
  const phaseIndex = pos.done ? phases.length : pos.phaseIndex;
  const secondsLeft = pos.done ? 0 : displaySeconds(pos.remaining);
  const lastPhaseCue = useRef(-1);
  const lastCountdownCue = useRef('');
  useEffect(() => {
    if (lastPhaseCue.current === phaseIndex) return;
    lastPhaseCue.current = phaseIndex;
    if (pos.done) {
      beep(660, 180);
      setTimeout(() => beep(880, 180), 200);
      setTimeout(() => beep(1320, 400), 400);
    } else {
      beep(pos.phase.kind === 'work' ? 880 : 520, 350);
    }
  }, [phaseIndex, pos, beep]);
  useEffect(() => {
    const cue = `${phaseIndex}:${secondsLeft}`;
    if (!running || pos.done || secondsLeft < 1 || secondsLeft > 3 || lastCountdownCue.current === cue) return;
    lastCountdownCue.current = cue;
    beep(440, 120);
  }, [phaseIndex, secondsLeft, running, pos.done, beep]);

  // --- Controls
  const seek = useCallback((target: number) => {
    const t = performance.now();
    setClock((c) => seekClock(c, t, target));
    setNow(t);
  }, []);
  const togglePause = useCallback(() => {
    const t = performance.now();
    setClock((c) => (isRunning(c) ? pauseClock(c, t) : resumeClock(c, t)));
    setNow(t);
  }, []);
  const skip = () => !pos.done && seek(skipTarget(phases, pos.phaseIndex));
  const back = () => (pos.done ? seek(phases.at(-1)!.start) : seek(backTarget(phases, pos.phaseIndex, elapsed)));

  function askToEnd() {
    setConfirmingEnd({ wasRunning: running });
    if (running) togglePause();
  }

  // Keyboard shortcuts: Space pause/resume, → skip, ← back.
  const keyActions = useRef({ togglePause, skip, back });
  keyActions.current = { togglePause, skip, back };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === ' ') {
        if (target?.closest('button, a')) return; // let the focused control handle Space itself
        e.preventDefault();
        keyActions.current.togglePause();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        keyActions.current.skip();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        keyActions.current.back();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toggleMute() {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? '0' : '1');
      } catch {
        // Not persisted; fine.
      }
      return !m;
    });
  }

  const header = (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">Running</p>
        <h1 className="text-3xl font-bold tracking-tight break-words">{workout.name}</h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!pos.done && (
          <Badge tone="neutral">
            Exercise {pos.phase.entryIndex + 1} of {entries.length}
          </Badge>
        )}
        <IconButton icon={muted ? VolumeX : Volume2} label="Mute sound" aria-pressed={muted} onClick={toggleMute} />
      </div>
    </header>
  );

  if (pos.done) {
    const streak =
      save.data && daysQuery.data
        ? streakStats(new Set([...daysQuery.data, dayKey(new Date(save.data.completedAt))]), new Date()).current
        : null;
    return (
      <>
        {header}
        <Card
          as="section"
          aria-live="polite"
          className="bg-linear-to-br from-orange-50 to-amber-50 py-10 text-center dark:from-orange-950/40 dark:to-stone-900"
        >
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-linear-to-br from-brand to-brand-2 text-white shadow-brand">
            <PartyPopper className="size-8" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-3xl font-bold">Workout complete</h2>
          <p className="mt-2 text-muted">
            You finished {workout.name}: {entries.length} exercise{entries.length === 1 ? '' : 's'}.
          </p>
          {streak !== null && (
            <p className="mt-3 font-display text-2xl font-bold" data-testid="run-streak">
              {streak >= 2 ? `🔥 ${streak}-day streak` : 'Day 1 of a new streak'}
            </p>
          )}
          <SaveStatus
            pending={save.isPending}
            error={save.isError ? (errorFor(save.error)?.message ?? 'Unknown error') : null}
            savedAt={save.data?.completedAt ?? null}
            onRetry={() => save.mutate()}
          />
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="primary" icon={RotateCcw} onClick={onRunAgain} autoFocus>
              Run again
            </Button>
            <Link to={`/workouts/${workout.id}`} className={buttonClass('secondary')}>
              Back to workout
            </Link>
          </div>
        </Card>
        <EntryList workout={workout} currentIndex={entries.length} />
      </>
    );
  }

  const { phase } = pos;
  const isWork = phase.kind === 'work';
  const entry = entries[phase.entryIndex]!;
  const nextEntry = isWork ? entries[phase.entryIndex + 1] : undefined;
  const progress = 1 - pos.remaining / phase.duration;
  const label = isWork ? `Exercise ${phase.entryIndex + 1} of ${entries.length}` : 'Rest';
  const remainingTotal = displaySeconds(totalDuration(phases) - elapsed);

  return (
    <>
      {header}

      {/* Announce phase changes only; the countdown itself isn't read out every second. */}
      <p className="sr-only" aria-live="polite">
        {isWork
          ? `${label}: ${entry.name}, ${formatShortDuration(phase.duration / 1000)}.`
          : `Rest ${formatShortDuration(phase.duration / 1000)}. Up next: ${entry.name}.`}
      </p>

      <Card as="section" aria-label="Current step" className={'text-center sm:p-8 ' + (isWork ? '' : 'bg-rest-soft/40')}>
        <ProgressRing progress={progress} kind={isWork ? 'work' : 'rest'} label={`${isWork ? 'Exercise' : 'Rest'} progress`}>
          <div>
            <p
              className={'text-xs font-bold tracking-widest uppercase ' + (isWork ? 'text-brand-ink' : 'text-rest')}
              data-testid="phase-label"
            >
              {isWork ? 'Work' : label}
            </p>
            <p
              role="timer"
              aria-label={`${secondsLeft} seconds left`}
              className="mt-1 font-display text-7xl leading-none font-bold tabular-nums sm:text-8xl"
              data-testid="countdown"
            >
              {formatSeconds(secondsLeft)}
            </p>
            {!running && <p className="mt-2 text-sm font-semibold text-amber-700 dark:text-amber-400">Paused</p>}
          </div>
        </ProgressRing>

        <div className="mt-6 min-h-16">
          {isWork ? (
            <>
              <h2 className="text-3xl font-bold break-words" data-testid="current-name">
                {entry.name}
              </h2>
              {entry.description && <p className="mx-auto mt-1 max-w-prose whitespace-pre-line break-words text-muted">{entry.description}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Up next</p>
              <h2 className="text-3xl font-bold break-words" data-testid="current-name">
                {entry.name}
              </h2>
            </>
          )}
        </div>

        {isWork && (
          <p className="mt-3 text-sm text-muted">
            {nextEntry ? (
              <>
                {workout.restSeconds > 0 ? `Then ${formatShortDuration(workout.restSeconds)} rest, up next: ` : 'Up next: '}
                <span className="font-semibold text-ink">{nextEntry.name}</span>{' '}
                <span className="tabular-nums">({formatShortDuration(nextEntry.durationSeconds)})</span>
              </>
            ) : (
              'Last exercise'
            )}
          </p>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button icon={SkipBack} onClick={back} aria-keyshortcuts="ArrowLeft" title="Back (←)">
          Back
        </Button>
        <Button
          variant="primary"
          icon={running ? Pause : Play}
          className="min-w-32"
          onClick={togglePause}
          aria-keyshortcuts="Space"
          title="Pause/Resume (Space)"
        >
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button icon={SkipForward} onClick={skip} aria-keyshortcuts="ArrowRight" title="Skip (→)">
          Skip
        </Button>
        <Button variant="ghostDanger" icon={Square} onClick={askToEnd}>
          End workout
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-1" aria-hidden="true">
        {entries.map((e, i) => (
          <span
            key={e.id}
            className={
              'h-1.5 w-8 rounded-full ' +
              (i < phase.entryIndex
                ? 'bg-brand'
                : i === phase.entryIndex && isWork
                  ? 'bg-orange-300 dark:bg-orange-700'
                  : 'bg-line')
            }
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Space to pause · ← → to go back or skip · {formatSeconds(remainingTotal)} left in total
      </p>

      <EntryList workout={workout} currentIndex={phase.entryIndex} currentIsRest={!isWork} />

      <ConfirmDialog
        open={confirmingEnd !== null}
        message={`End ${workout.name}? You're on exercise ${phase.entryIndex + 1} of ${entries.length}.`}
        confirmLabel="End workout"
        pending={false}
        onConfirm={() => navigate(`/workouts/${workout.id}`)}
        onCancel={() => {
          if (confirmingEnd?.wasRunning) togglePause();
          setConfirmingEnd(null);
        }}
      />
    </>
  );
}

function SaveStatus({
  pending,
  error,
  savedAt,
  onRetry,
}: {
  pending: boolean;
  error: string | null;
  savedAt: number | null;
  onRetry: () => void;
}) {
  if (pending) return <p className="mt-3 text-sm text-muted">Saving to your progress…</p>;
  if (error) {
    return (
      <div className="mt-3 flex items-center justify-center gap-3" role="alert">
        <p className="text-sm text-red-700 dark:text-red-400">Couldn't save this run: {error}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    );
  }
  if (savedAt === null) return null;
  const day = new Date(savedAt);
  return (
    <p className="mt-3 text-sm text-muted">
      Saved.{' '}
      <Link to={`/?month=${monthKey(monthOf(day))}&day=${dayKey(day)}`} className="font-semibold text-brand-ink hover:underline">
        See your progress
      </Link>
    </p>
  );
}

function EntryList({ workout, currentIndex, currentIsRest = false }: { workout: Workout; currentIndex: number; currentIsRest?: boolean }) {
  return (
    <section aria-label="Exercises" className="mt-10">
      <h2 className="mb-2 text-sm font-semibold">Exercises</h2>
      <Card padding="none">
        <ol className="divide-y divide-line text-sm">
          {workout.exercises.map((e, i) => {
            const status = i < currentIndex ? 'done' : i === currentIndex ? (currentIsRest ? 'next' : 'current') : 'upcoming';
            return (
              <li
                key={e.id}
                aria-current={status === 'current' ? 'step' : undefined}
                data-status={status}
                className={
                  'flex items-center gap-3 px-4 py-2.5 ' +
                  (status === 'done' ? 'text-muted' : status === 'current' ? 'bg-brand-soft/50 font-semibold' : '')
                }
              >
                <span className="flex w-6 justify-end tabular-nums" aria-hidden="true">
                  {status === 'done' ? <Check className="size-4 text-brand" /> : `${i + 1}.`}
                </span>
                <span className={'min-w-0 flex-1 break-words ' + (status === 'done' ? 'line-through decoration-muted/50' : '')}>{e.name}</span>
                {status === 'current' && <Badge>Now</Badge>}
                {status === 'next' && <Badge tone="neutral">Next</Badge>}
                {status === 'done' && <span className="sr-only">done</span>}
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
}
