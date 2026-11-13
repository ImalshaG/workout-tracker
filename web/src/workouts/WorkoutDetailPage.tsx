import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError, errorFor } from '../api/client';
import {
  deleteWorkout,
  getWorkout,
  removeWorkoutExercise,
  setEntryDuration,
  updateWorkout,
  reorderWorkoutExercises,
  WORKOUT_FIELDS,
  workoutKeys,
  type Workout,
} from '../api/workouts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NotFound } from '../components/NotFound';
import { Button, FieldError, inputClass, LoadError, StatusLine } from '../components/ui';
import { InlineSeconds } from '../components/SecondsInput';
import { formatShortDuration, REST_MAX_SECONDS } from '../time';
import { usePageTitle } from '../usePageTitle';
import { AddExercisesDialog } from './AddExercisesDialog';
import { RunLink } from './RunLink';
import { SortableExerciseList } from './SortableExerciseList';

export function WorkoutDetailPage() {
  const { id } = useParams();
  if (!id || !/^[1-9]\d{0,15}$/.test(id)) return <WorkoutNotFound />;
  return <WorkoutDetail key={id} id={Number(id)} />;
}

function WorkoutNotFound() {
  usePageTitle('Workout not found');
  return <NotFound title="Workout not found" backTo="/workouts" backLabel="Back to workouts" />;
}

const is404 = (err: unknown) => err instanceof ApiRequestError && err.status === 404;

function WorkoutDetail({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const key = workoutKeys.detail(id);
  const query = useQuery({ queryKey: key, queryFn: () => getWorkout(id) });
  usePageTitle(query.data?.name ?? 'Workout');

  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const renameButtonRef = useRef<HTMLButtonElement>(null);

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: workoutKeys.all });

  const reorder = useMutation({
    mutationFn: (entryIds: number[]) => reorderWorkoutExercises(id, entryIds),
    onMutate: async (entryIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Workout>(key);
      if (previous) {
        const byId = new Map(previous.exercises.map((e) => [e.id, e]));
        queryClient.setQueryData<Workout>(key, { ...previous, exercises: entryIds.map((e) => byId.get(e)!) });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (workout) => queryClient.setQueryData(key, workout),
    onSettled: refreshAll,
  });

  const changeDuration = useMutation({
    mutationFn: ({ entryId, seconds }: { entryId: number; seconds: number | null }) => setEntryDuration(id, entryId, seconds),
    onSuccess: (workout) => queryClient.setQueryData(key, workout),
    onSettled: refreshAll,
  });

  const changeRest = useMutation({
    mutationFn: (restSeconds: number) => updateWorkout(id, { name: query.data!.name, restSeconds }),
    onSuccess: (workout) => queryClient.setQueryData(key, workout),
    onSettled: refreshAll,
  });

  const removeEntry = useMutation({
    mutationFn: async (entryId: number) => {
      try {
        return await removeWorkoutExercise(id, entryId);
      } catch (err) {
        if (is404(err)) return null; // already removed elsewhere; the refetch will catch up
        throw err;
      }
    },
    onSuccess: (workout) => {
      if (workout) queryClient.setQueryData(key, workout);
    },
    onSettled: refreshAll,
  });

  const removeWorkout = useMutation({
    mutationFn: async () => {
      try {
        await deleteWorkout(id);
      } catch (err) {
        if (!is404(err)) throw err;
      }
    },
    onSuccess: () => {
      setConfirmingDelete(false);
      void navigate('/workouts');
      queryClient.removeQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: workoutKeys.list() });
    },
  });

  if (query.isPending) return <StatusLine>Loading workout…</StatusLine>;
  if (query.isError) {
    if (is404(query.error)) return <WorkoutNotFound />;
    return <LoadError what="this workout" onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const workout = query.data;
  const actionError = errorFor(reorder.error ?? removeEntry.error ?? changeDuration.error ?? changeRest.error)?.message;
  const workSeconds = workout.exercises.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalSeconds = workSeconds + workout.restSeconds * Math.max(workout.exercises.length - 1, 0);
  const deleteError = errorFor(removeWorkout.error)?.message;
  const busy = reorder.isPending || removeEntry.isPending || changeDuration.isPending;
  const resetActionErrors = () => {
    reorder.reset();
    removeEntry.reset();
    changeDuration.reset();
    changeRest.reset();
  };

  return (
    <>
      <Link to="/workouts" className="mb-4 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← All workouts
      </Link>

      {renaming ? (
        <RenameForm
          workout={workout}
          onDone={() => {
            setRenaming(false);
            requestAnimationFrame(() => renameButtonRef.current?.focus());
          }}
        />
      ) : (
        <header className="mb-6 flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{workout.name}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <RunLink workoutId={id} exerciseCount={workout.exercises.length} />
            <Button ref={renameButtonRef} variant="ghost" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button
              variant="ghostDanger"
              onClick={() => {
                removeWorkout.reset();
                setConfirmingDelete(true);
              }}
            >
              Delete
            </Button>
          </div>
        </header>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <label className="flex items-center gap-2">
          Rest between exercises
          <InlineSeconds
            value={workout.restSeconds}
            min={0}
            max={REST_MAX_SECONDS}
            label="Rest between exercises, in seconds"
            disabled={changeRest.isPending}
            onCommit={(s) => {
              resetActionErrors();
              changeRest.mutate(s);
            }}
          />
        </label>
        {workout.exercises.length > 0 && <span data-testid="total-time">Total run time: {formatShortDuration(totalSeconds)}</span>}
      </div>

      <section aria-labelledby="entries-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="entries-heading" className="text-lg font-semibold">
            Exercises <span className="font-normal text-zinc-500">({workout.exercises.length})</span>
          </h2>
          <Button variant="primary" onClick={() => setAdding(true)}>
            Add exercises
          </Button>
        </div>

        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </p>
        )}

        {workout.exercises.length === 0 ? (
          <p className="py-6 text-zinc-500">No exercises in this workout yet. Use “Add exercises” to pick some.</p>
        ) : (
          <div className="mt-2">
            <SortableExerciseList
              label={`Exercises in ${workout.name}`}
              items={workout.exercises.map((e) => ({
                key: e.id,
                name: e.name,
                description: e.description,
                duration: { seconds: e.durationSeconds, defaultSeconds: e.defaultSeconds, custom: e.overrideSeconds !== null },
              }))}
              onDurationChange={(entryId, seconds) => {
                resetActionErrors();
                changeDuration.mutate({ entryId, seconds });
              }}
              durationPendingKey={changeDuration.isPending ? changeDuration.variables.entryId : undefined}
              onReorder={(entryIds) => {
                resetActionErrors();
                reorder.mutate(entryIds);
              }}
              onRemove={(entryId) => {
                resetActionErrors();
                removeEntry.mutate(entryId);
              }}
              dragDisabled={busy}
              removingKey={removeEntry.isPending ? removeEntry.variables : undefined}
            />
          </div>
        )}
      </section>

      <AddExercisesDialog workoutId={id} workoutName={workout.name} open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={confirmingDelete}
        message={
          deleteError
            ? `Couldn't delete ${workout.name}: ${deleteError}`
            : `Delete ${workout.name}? This can't be undone.`
        }
        confirmLabel={deleteError ? 'Try again' : 'Delete'}
        pending={removeWorkout.isPending}
        onConfirm={() => removeWorkout.mutate()}
        onCancel={() => {
          setConfirmingDelete(false);
          removeWorkout.reset();
        }}
      />
    </>
  );
}

function RenameForm({ workout, onDone }: { workout: Workout; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(workout.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const mutation = useMutation({
    mutationFn: () => updateWorkout(workout.id, { name }),
    onSuccess: (updated) => {
      queryClient.setQueryData(workoutKeys.detail(workout.id), updated);
      onDone();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });

  const err = errorFor(mutation.error, WORKOUT_FIELDS);
  const canSave = name.trim() !== '' && !mutation.isPending;
  const save = () => canSave && mutation.mutate();

  return (
    <div
      className="mb-6"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !mutation.isPending) {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium">
        Workout name
      </label>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id={`${id}-name`}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              }
            }}
            maxLength={100}
            autoComplete="off"
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `${id}-error` : undefined}
          />
          <FieldError id={`${id}-error`} message={err?.message} />
        </div>
        <Button variant="primary" className="mt-1" onClick={save} disabled={!canSave}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button className="mt-1" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
