import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError, errorFor } from '../api/client';
import { logRun, runKeys } from '../api/runs';
import { dayKey, monthKey, monthOf } from '../progress/dates';
import { getWorkout, workoutKeys, type Workout } from '../api/workouts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NotFound } from '../components/NotFound';
import { Button, buttonClass, LoadError, PageHeader, StatusLine } from '../components/ui';
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
          <p className="text-zinc-500">This workout has no exercises yet, so there's nothing to run.</p>
          <Link to={`/workouts/${id}`} className={buttonClass('secondary', 'mt-4')}>
            Back to workout
          </Link>
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
        <p className="text-sm text-zinc-500">Running</p>
        <h1 className="text-2xl font-bold tracking-tight break-words">{workout.name}</h1>
      </div>
      <Button variant="ghost" onClick={toggleMute} aria-pressed={muted} title={muted ? 'Sound off' : 'Sound on'}>
        {muted ? 'Sound off' : 'Sound on'}
      </Button>
    </header>
  );

  if (pos.done) {
    return (
      <>
        {header}
        <section className="rounded-lg border border-emerald-500/30 bg-emerald-50 p-8 text-center dark:bg-emerald-950/30" aria-live="polite">
          <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">Workout complete</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-300">
            You finished {workout.name}: {entries.length} exercise{entries.length === 1 ? '' : 's'}.
          </p>
          <SaveStatus
            pending={save.isPending}
            error={save.isError ? (errorFor(save.error)?.message ?? 'Unknown error') : null}
            savedAt={save.data?.completedAt ?? null}
            onRetry={() => save.mutate()}
          />
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="primary" onClick={onRunAgain} autoFocus>
              Run again
            </Button>
            <Link to={`/workouts/${workout.id}`} className={buttonClass('secondary')}>
              Back to workout
            </Link>
          </div>
        </section>
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

      <section
        aria-label="Current step"
        className={
          'rounded-lg border p-6 sm:p-8 ' +
          (isWork
            ? 'border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30'
            : 'border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30')
        }
      >
        <div className="flex items-baseline justify-between gap-4">
          <p
            className={
              'text-sm font-semibold tracking-wide uppercase ' +
              (isWork ? 'text-indigo-700 dark:text-indigo-300' : 'text-emerald-700 dark:text-emerald-300')
            }
            data-testid="phase-label"
          >
            {label}
          </p>
          {!running && <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Paused</p>}
        </div>

        <div className="mt-3 min-h-16">
          {isWork ? (
            <>
              <h2 className="text-3xl font-bold break-words" data-testid="current-name">
                {entry.name}
              </h2>
              {entry.description && (
                <p className="mt-1 whitespace-pre-line break-words text-zinc-600 dark:text-zinc-400">{entry.description}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500">Up next</p>
              <h2 className="text-3xl font-bold break-words" data-testid="current-name">
                {entry.name}
              </h2>
            </>
          )}
        </div>

        <p
          role="timer"
          aria-label={`${secondsLeft} seconds left`}
          className="mt-6 text-center text-7xl font-bold tabular-nums sm:text-8xl"
          data-testid="countdown"
        >
          {formatSeconds(secondsLeft)}
        </p>

        <div
          className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
          role="progressbar"
          aria-label={`${isWork ? 'Exercise' : 'Rest'} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className={'h-full rounded-full ' + (isWork ? 'bg-indigo-600' : 'bg-emerald-600')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {isWork && (
          <p className="mt-4 text-sm text-zinc-500">
            {nextEntry ? (
              <>
                {workout.restSeconds > 0 ? `Then ${formatShortDuration(workout.restSeconds)} rest, up next: ` : 'Up next: '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{nextEntry.name}</span>{' '}
                <span className="tabular-nums">({formatShortDuration(nextEntry.durationSeconds)})</span>
              </>
            ) : (
              'Last exercise'
            )}
          </p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={back} aria-keyshortcuts="ArrowLeft" title="Back (←)">
          ← Back
        </Button>
        <Button variant="primary" className="min-w-28" onClick={togglePause} aria-keyshortcuts="Space" title="Pause/Resume (Space)">
          {running ? 'Pause' : 'Resume'}
        </Button>
        <Button onClick={skip} aria-keyshortcuts="ArrowRight" title="Skip (→)">
          Skip →
        </Button>
        <Button variant="ghostDanger" onClick={askToEnd}>
          End workout
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-500">
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
  if (pending) return <p className="mt-3 text-sm text-zinc-500">Saving to your progress…</p>;
  if (error) {
    return (
      <div className="mt-3 flex items-center justify-center gap-3" role="alert">
        <p className="text-sm text-red-600 dark:text-red-400">Couldn't save this run: {error}</p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    );
  }
  if (savedAt === null) return null;
  const day = new Date(savedAt);
  return (
    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
      Saved.{' '}
      <Link
        to={`/?month=${monthKey(monthOf(day))}&day=${dayKey(day)}`}
        className="text-indigo-600 hover:underline dark:text-indigo-400"
      >
        See your progress
      </Link>
    </p>
  );
}

function EntryList({ workout, currentIndex, currentIsRest = false }: { workout: Workout; currentIndex: number; currentIsRest?: boolean }) {
  return (
    <section aria-label="Exercises" className="mt-10">
      <h2 className="mb-2 text-sm font-semibold">Exercises</h2>
      <ol className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {workout.exercises.map((e, i) => {
          const status = i < currentIndex ? 'done' : i === currentIndex ? (currentIsRest ? 'next' : 'current') : 'upcoming';
          return (
            <li
              key={e.id}
              aria-current={status === 'current' ? 'step' : undefined}
              data-status={status}
              className={
                'flex items-center gap-3 py-2 ' +
                (status === 'done' ? 'text-zinc-400 dark:text-zinc-600' : status === 'current' ? 'font-semibold' : '')
              }
            >
              <span className="w-6 text-right tabular-nums" aria-hidden="true">
                {status === 'done' ? '✓' : `${i + 1}.`}
              </span>
              <span className="min-w-0 flex-1 break-words">{e.name}</span>
              {status === 'current' && <span className="text-xs text-indigo-600 dark:text-indigo-400">Now</span>}
              {status === 'next' && <span className="text-xs text-emerald-600 dark:text-emerald-400">Next</span>}
              {status === 'done' && <span className="sr-only">done</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
