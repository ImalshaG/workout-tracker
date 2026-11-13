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
