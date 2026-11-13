import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { errorFor } from '../api/client';
import { createWorkout, WORKOUT_FIELDS, workoutKeys } from '../api/workouts';
import { Modal } from '../components/Modal';
import { parseSeconds, SecondsField } from '../components/SecondsInput';
import { DEFAULT_REST_SECONDS, formatShortDuration, REST_MAX_SECONDS } from '../time';
import { Button, FieldError, inputClass } from '../components/ui';
import { effectiveSeconds, ExerciseSelection, toExerciseItems, type Selected } from './ExerciseSelection';

export function NewWorkoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const headingId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} className="w-[min(40rem,calc(100%-2rem))]">
      <NewWorkoutForm headingId={headingId} onClose={onClose} />
    </Modal>
  );
}

function NewWorkoutForm({ headingId, onClose }: { headingId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Selected[]>([]);
  const [rest, setRest] = useState(String(DEFAULT_REST_SECONDS));
  const id = useId();

  const mutation = useMutation({
    mutationFn: () => createWorkout({ name, restSeconds: parseSeconds(rest), exerciseIds: toExerciseItems(selected) }),
    onSuccess: (workout) => {
      queryClient.setQueryData(workoutKeys.detail(workout.id), workout);
      onClose();
      void navigate(`/workouts/${workout.id}`);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
  });

  const err = errorFor(mutation.error, WORKOUT_FIELDS);
  const nameError = err?.field === 'name' ? err.message : undefined;
  const restError = err?.field === 'restSeconds' ? err.message : undefined;
  const otherError = err && err.field !== 'name' && err.field !== 'restSeconds' ? err.message : undefined;
  const restSeconds = parseSeconds(rest) ?? 0;
  const totalSeconds = selected.reduce((sum, s) => sum + effectiveSeconds(s), 0) + restSeconds * Math.max(selected.length - 1, 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && mutation.isPending) e.preventDefault();
      }}
    >
      <h2 id={headingId} className="text-xl font-bold">
        New workout
      </h2>
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-sm font-medium">
          Name <span className="text-muted">(required)</span>
        </label>
        <input
          id={`${id}-name`}
          data-autofocus
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoComplete="off"
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
        />
        <FieldError id={`${id}-name-error`} message={nameError} />
      </div>
      <SecondsField
        id={`${id}-rest`}
        label="Rest between exercises"
        value={rest}
        onChange={setRest}
        min={0}
        max={REST_MAX_SECONDS}
        error={restError}
        hint="Use 0 for no rest."
      />
      <ExerciseSelection
        selected={selected}
        onChange={setSelected}
        selectedLabel="Exercises in this workout"
        emptyHint="No exercises yet. Add some from the library below, or add them later."
      />
      {selected.length > 0 && (
        <p className="text-sm text-muted" data-testid="new-total">
          Total run time: {formatShortDuration(totalSeconds)}. Change an exercise's seconds above to set a custom time for this
          workout.
        </p>
      )}
      <FieldError id={`${id}-error`} message={otherError} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending ? 'Creating…' : 'Create workout'}
        </Button>
      </div>
    </form>
  );
}
