import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, errorFor } from '../api/client';
import { deleteExercise, exerciseKeys, listExercises, type Exercise } from '../api/exercises';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LoadError, StatusLine } from '../components/ui';
import { ExerciseRowEdit, ExerciseRowView } from './ExerciseRow';

export function ExerciseList() {
  const queryClient = useQueryClient();
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
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });

  if (query.isPending) return <StatusLine>Loading exercises…</StatusLine>;
  if (query.isError) {
    return <LoadError what="exercises" onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const exercises = query.data;
  const deleteError = errorFor(remove.error);

  return (
    <>
      {exercises.length === 0 ? (
        <p className="py-6 text-zinc-500">No exercises yet. Use the + button to add your first one.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {exercises.map((exercise) =>
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
