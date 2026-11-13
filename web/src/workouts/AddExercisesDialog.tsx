import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorFor } from '../api/client';
import { addWorkoutExercises, workoutKeys } from '../api/workouts';
import { Modal } from '../components/Modal';
import { Button, FieldError } from '../components/ui';
import { ExerciseSelection, toExerciseItems, type Selected } from './ExerciseSelection';

interface Props {
  workoutId: number;
  workoutName: string;
  open: boolean;
  onClose: () => void;
}

export function AddExercisesDialog({ workoutId, workoutName, open, onClose }: Props) {
  const headingId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} className="w-[min(40rem,calc(100%-2rem))]">
      <AddExercisesForm headingId={headingId} workoutId={workoutId} workoutName={workoutName} onClose={onClose} />
    </Modal>
  );
}

function AddExercisesForm({ headingId, workoutId, workoutName, onClose }: Omit<Props, 'open'> & { headingId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Selected[]>([]);
  const errorId = useId();

  const mutation = useMutation({
    mutationFn: () => addWorkoutExercises(workoutId, toExerciseItems(selected)),
    onSuccess: (workout) => {
      queryClient.setQueryData(workoutKeys.detail(workoutId), workout);
      onClose();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });

  const error = errorFor(mutation.error)?.message;
  const n = selected.length;

  return (
    <div
      className="space-y-5"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && mutation.isPending) e.preventDefault();
      }}
    >
      <h2 id={headingId} className="text-lg font-semibold break-words">
        Add exercises to {workoutName}
      </h2>
      <ExerciseSelection
        selected={selected}
        onChange={setSelected}
        selectedLabel="To add"
        emptyHint="Pick exercises from the library below. They'll be added to the end of the workout in this order."
      />
      <FieldError id={errorId} message={error} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={mutation.isPending} data-autofocus>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => mutation.mutate()} disabled={n === 0 || mutation.isPending}>
          {mutation.isPending ? 'Adding…' : n === 0 ? 'Add' : `Add ${n} exercise${n === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  );
}
