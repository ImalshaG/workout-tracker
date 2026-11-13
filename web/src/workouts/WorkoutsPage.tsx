import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Clock, Dumbbell, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiRequestError, errorFor } from '../api/client';
import { deleteWorkout, listWorkouts, workoutKeys, type WorkoutSummary } from '../api/workouts';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Menu } from '../components/Menu';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, EmptyState, focusRing, LoadError, PageHeader, StatusLine } from '../components/ui';
import { formatShortDuration } from '../time';
import { usePageTitle } from '../usePageTitle';
import { formatLastDone } from './lastRun';
import { NewWorkoutDialog } from './NewWorkoutDialog';
import { RunLink } from './RunLink';
import { useLastRuns } from './useLastRuns';

export function WorkoutsPage() {
  usePageTitle('Workouts');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const query = useQuery({ queryKey: workoutKeys.list(), queryFn: listWorkouts });
  const last = useLastRuns();
  const now = new Date();
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
      toast(`Deleted ${workout.name}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.list() }),
  });
  const deleteError = errorFor(remove.error);

  return (
    <>
      <PageHeader
        title="Workouts"
        subtitle="Build routines from your exercises, then start one."
        action={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New workout
          </Button>
        }
      />
      <section aria-label="Workouts">
        {query.isPending ? (
          <StatusLine>Loading workouts…</StatusLine>
        ) : query.isError ? (
          <LoadError what="workouts" onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No workouts yet"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                Create your first workout
              </Button>
            }
          >
            A workout is an ordered list of exercises with rest between them.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {query.data.map((workout) => (
              <Card as="li" key={workout.id} className="relative flex flex-col hover:border-brand/40 motion-safe:transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 text-lg font-bold break-words">
                    {/* The title link stretches over the card, so the whole card opens the editor. */}
                    <Link to={`/workouts/${workout.id}`} className={`rounded after:absolute after:inset-0 after:rounded-card ${focusRing}`}>
                      {workout.name}
                    </Link>
                  </h2>
                  <Menu
                    className="relative z-10 -mt-1 -mr-2"
                    label={`Actions for ${workout.name}`}
                    items={[
                      { label: 'Edit', icon: Pencil, onSelect: () => void navigate(`/workouts/${workout.id}`) },
                      {
                        label: 'Delete',
                        icon: Trash2,
                        danger: true,
                        disabled: remove.isPending && remove.variables?.id === workout.id,
                        onSelect: () => {
                          remove.reset();
                          setConfirming(workout);
                        },
                      },
                    ]}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge icon={ListChecks}>
                    {workout.exerciseCount} exercise{workout.exerciseCount === 1 ? '' : 's'}
                  </Badge>
                  {workout.exerciseCount > 0 && <Badge icon={Clock}>{formatShortDuration(workout.totalSeconds)}</Badge>}
                </div>
                {last && <p className="mt-3 text-sm text-muted">Last done: {formatLastDone(last.get(workout.id), now)}</p>}
                <div className="mt-auto pt-4">
                  <RunLink workoutId={workout.id} exerciseCount={workout.exerciseCount} className="relative z-10 w-full" />
                </div>
              </Card>
            ))}
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className={`grid h-full min-h-40 w-full place-items-center rounded-card border-2 border-dashed border-line text-muted hover:border-brand/50 hover:text-brand-ink ${focusRing}`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Plus className="size-5" aria-hidden="true" />
                  New workout
                </span>
              </button>
            </li>
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
