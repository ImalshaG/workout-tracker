import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ApiRequestError, errorFor } from '../api/client';
import { deleteWorkout, listWorkouts, workoutKeys, type WorkoutSummary } from '../api/workouts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddButton, Button, LoadError, PageHeader, StatusLine } from '../components/ui';
import { formatShortDuration } from '../time';
import { usePageTitle } from '../usePageTitle';
import { NewWorkoutDialog } from './NewWorkoutDialog';
import { RunLink } from './RunLink';

export function WorkoutsPage() {
  usePageTitle('Workouts');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: workoutKeys.list(), queryFn: listWorkouts });
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<WorkoutSummary | null>(null);

  const remove = useMutation({
    mutationFn: async (workout: WorkoutSummary) => {
      try {
        await deleteWorkout(workout.id);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 404) return; // already gone
        throw err;
      }
    },
    onSuccess: (_data, workout) => {
      queryClient.setQueryData<WorkoutSummary[]>(workoutKeys.list(), (rows) => rows?.filter((r) => r.id !== workout.id));
      queryClient.removeQueries({ queryKey: workoutKeys.detail(workout.id) });
      setConfirming(null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.list() }),
  });
  const deleteError = errorFor(remove.error);

  return (
    <>
      <PageHeader title="Workouts" action={<AddButton label="New workout" onClick={() => setCreating(true)} />} />
      <section aria-label="Workouts">
        {query.isPending ? (
          <StatusLine>Loading workouts…</StatusLine>
        ) : query.isError ? (
          <LoadError what="workouts" onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : query.data.length === 0 ? (
          <p className="py-6 text-zinc-500">No workouts yet. Use the + button to create your first one.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {query.data.map((workout) => (
              <li key={workout.id} className="flex items-center gap-4 py-3">
                <Link
                  to={`/workouts/${workout.id}`}
                  className="-mx-2 min-w-0 flex-1 rounded-md px-2 py-1 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:hover:bg-zinc-900"
                >
                  <span className="block font-medium break-words">{workout.name}</span>
                  <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                    {workout.exerciseCount} exercise{workout.exerciseCount === 1 ? '' : 's'}
                    {workout.exerciseCount > 0 && ` · ${formatShortDuration(workout.totalSeconds)}`}
                  </span>
                </Link>
                <RunLink workoutId={workout.id} exerciseCount={workout.exerciseCount} compact />
                <Button
                  variant="ghostDanger"
                  onClick={() => {
                    remove.reset();
                    setConfirming(workout);
                  }}
                  disabled={remove.isPending && remove.variables?.id === workout.id}
                  aria-label={`Delete ${workout.name}`}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewWorkoutDialog open={creating} onClose={() => setCreating(false)} />
      <ConfirmDialog
        open={confirming !== null}
        message={
          !confirming
            ? ''
            : deleteError
              ? `Couldn't delete ${confirming.name}: ${deleteError.message}`
              : `Delete ${confirming.name}? This can't be undone.`
        }
        confirmLabel={deleteError ? 'Try again' : 'Delete'}
        pending={remove.isPending}
        onConfirm={() => confirming && remove.mutate(confirming)}
        onCancel={() => {
          setConfirming(null);
          remove.reset();
        }}
      />
    </>
  );
}
