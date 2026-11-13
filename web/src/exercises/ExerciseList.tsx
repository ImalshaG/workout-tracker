import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, errorFor } from '../api/client';
import { deleteExercise, exerciseKeys, listExercises, type Exercise } from '../api/exercises';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ListChecks, Plus, Search } from 'lucide-react';
import { useToast } from '../components/Toast';
import { Button, EmptyState, inputClass, LoadError, StatusLine } from '../components/ui';
import { filterByName } from './filter';
import { ExerciseRowEdit, ExerciseRowView } from './ExerciseRow';

export function ExerciseList({ onAdd }: { onAdd: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: exerciseKeys.all, queryFn: listExercises });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [returnFocusId, setReturnFocusId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<Exercise | null>(null);

  const remove = useMutation({
    mutationFn: async (exercise: Exercise) => {
      try {
        await deleteExercise(exercise.id);
      } catch (err) {
        // Already gone: treat as deleted.
        if (err instanceof ApiRequestError && err.status === 404) return;
        throw err;
      }
    },
    onSuccess: (_data, exercise) => {
      queryClient.setQueryData<Exercise[]>(exerciseKeys.all, (rows) => rows?.filter((r) => r.id !== exercise.id));
      if (editingId === exercise.id) setEditingId(null);
      setConfirming(null);
      toast(`Deleted ${exercise.name}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });

  if (query.isPending) return <StatusLine>Loading exercises…</StatusLine>;
  if (query.isError) {
    return <LoadError what="exercises" onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const exercises = query.data;
  const shown = filterByName(exercises, search);
  const deleteError = errorFor(remove.error);

  return (
    <>
      {exercises.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No exercises yet"
          action={
            <Button variant="primary" icon={Plus} onClick={onAdd}>
              Add your first exercise
            </Button>
          }
        >
          Add the moves you do, like Plank or Squats, with how long each one runs.
        </EmptyState>
      ) : (
        <>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search exercises"
            placeholder="Search exercises"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass + ' pl-9'}
          />
        </div>
        {shown.length === 0 && (
          <p className="py-6 text-center text-muted" role="status">
            No exercises match “{search.trim()}”.
          </p>
        )}
        <ul className="space-y-2">
          {shown.map((exercise) =>
            exercise.id === editingId ? (
              <ExerciseRowEdit
                key={exercise.id}
                exercise={exercise}
                onDone={() => {
                  setEditingId(null);
                  setReturnFocusId(exercise.id);
                }}
              />
            ) : (
              <ExerciseRowView
                key={exercise.id}
                exercise={exercise}
                focusEdit={returnFocusId === exercise.id}
                deleting={remove.isPending && remove.variables?.id === exercise.id}
                onEdit={() => {
                  setReturnFocusId(null);
                  setEditingId(exercise.id);
                }}
                onDelete={() => {
                  remove.reset();
                  setConfirming(exercise);
                }}
              />
            ),
          )}
        </ul>
        </>
      )}
      <ConfirmDialog
        open={confirming !== null}
        message={
          !confirming
            ? ''
            : deleteError?.code === 'EXERCISE_IN_USE'
              ? `Can't delete ${confirming.name}. ${deleteError.message}`
              : deleteError
                ? `Couldn't delete ${confirming.name}: ${deleteError.message}`
                : `Delete ${confirming.name}? This can't be undone.`
        }
        confirmLabel={deleteError?.code === 'EXERCISE_IN_USE' ? undefined : deleteError ? 'Try again' : 'Delete'}
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
