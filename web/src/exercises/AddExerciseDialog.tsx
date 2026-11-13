import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorFor } from '../api/client';
import { createExercise, EXERCISE_FIELDS, exerciseKeys } from '../api/exercises';
import { Modal } from '../components/Modal';
import { parseSeconds, SecondsField } from '../components/SecondsInput';
import { DEFAULT_DURATION_SECONDS, DURATION_MAX_SECONDS, DURATION_MIN_SECONDS } from '../time';
import { useToast } from '../components/Toast';
import { Button, FieldError, inputClass } from '../components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddExerciseDialog({ open, onClose }: Props) {
  const headingId = useId();
  return (
    <Modal open={open} onClose={onClose} labelledBy={headingId} className="w-[min(32rem,calc(100%-2rem))]">
      <AddExerciseForm headingId={headingId} onClose={onClose} />
    </Modal>
  );
}

function AddExerciseForm({ headingId, onClose }: { headingId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(String(DEFAULT_DURATION_SECONDS));
  const id = useId();

  const mutation = useMutation({
    mutationFn: createExercise,
    onSuccess: (exercise) => {
      toast(`Added ${exercise.name}`);
      onClose();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: exerciseKeys.all }),
  });

  const err = errorFor(mutation.error, EXERCISE_FIELDS);
  const nameError = err?.field === 'name' ? err.message : undefined;
  const descriptionError = err?.field === 'description' ? err.message : undefined;
  const durationError = err?.field === 'durationSeconds' ? err.message : undefined;
  const generalError = err && !err.field ? err.message : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || mutation.isPending) return;
    mutation.mutate({ name, description, durationSeconds: parseSeconds(duration) });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4"
      // Keep the dialog open while the request is in flight (preventing keydown suppresses the cancel event).
      onKeyDown={(e) => {
        if (e.key === 'Escape' && mutation.isPending) e.preventDefault();
      }}
    >
      <h2 id={headingId} className="text-xl font-bold">
        Add exercise
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
      <div>
        <label htmlFor={`${id}-description`} className="mb-1 block text-sm font-medium">
          Description <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id={`${id}-description`}
          className={inputClass}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError ? `${id}-description-error` : undefined}
        />
        <FieldError id={`${id}-description-error`} message={descriptionError} />
      </div>
      <SecondsField
        id={`${id}-duration`}
        label="Duration"
        value={duration}
        onChange={setDuration}
        min={DURATION_MIN_SECONDS}
        max={DURATION_MAX_SECONDS}
        error={durationError}
        hint="How long this exercise runs in a workout. Workouts can override it."
      />
      <FieldError id={`${id}-error`} message={generalError} />
      <div className="flex justify-end gap-2">
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || mutation.isPending}>
          {mutation.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </form>
  );
}
