import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorFor } from '../api/client';
import { EXERCISE_FIELDS, exerciseKeys, updateExercise, type Exercise } from '../api/exercises';
import { workoutKeys } from '../api/workouts';
import { parseSeconds, SecondsField } from '../components/SecondsInput';
import { Button, FieldError, inputClass } from '../components/ui';
import { DURATION_MAX_SECONDS, DURATION_MIN_SECONDS, formatShortDuration } from '../time';

interface ViewProps {
  exercise: Exercise;
  focusEdit: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ExerciseRowView({ exercise, focusEdit, deleting, onEdit, onDelete }: ViewProps) {
  const editRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusEdit) editRef.current?.focus();
  }, [focusEdit]);

  return (
    <li className="flex items-start gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium break-words">{exercise.name}</span>
          <span className="text-sm text-zinc-500 tabular-nums" data-testid="exercise-duration">
            {formatShortDuration(exercise.durationSeconds)}
          </span>
        </p>
        {exercise.description && (
          <p className="mt-1 text-sm whitespace-pre-line break-words text-zinc-500 dark:text-zinc-400">
            {exercise.description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button ref={editRef} variant="ghost" onClick={onEdit} aria-label={`Edit ${exercise.name}`}>
          Edit
        </Button>
        <Button
          variant="ghostDanger"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`Delete ${exercise.name}`}
        >
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
      </div>
    </li>
  );
}

interface EditProps {
  exercise: Exercise;
  onDone: () => void;
}

export function ExerciseRowEdit({ exercise, onDone }: EditProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(exercise.name);
  const [description, setDescription] = useState(exercise.description ?? '');
  const [duration, setDuration] = useState(String(exercise.durationSeconds));
  const nameRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    nameRef.current?.select();
  }, []);

  const mutation = useMutation({
    mutationFn: () => updateExercise(exercise.id, { name, description, durationSeconds: parseSeconds(duration) }),
    onSuccess: onDone,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
      // Workouts show exercise names.
      void queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });

  const err = errorFor(mutation.error, EXERCISE_FIELDS);
  const nameError = err?.field === 'name' ? err.message : undefined;
  const descriptionError = err?.field === 'description' ? err.message : undefined;
  const durationError = err?.field === 'durationSeconds' ? err.message : undefined;
  const generalError = err && !err.field ? err.message : undefined;
  const canSave = name.trim() !== '' && !mutation.isPending;

  function save() {
    if (canSave) mutation.mutate();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !mutation.isPending) {
      e.preventDefault();
      onDone();
    }
  }

  return (
    <li className="py-4" onKeyDown={onKeyDown}>
      <div className="space-y-3">
        <div>
          <label htmlFor={`${id}-name`} className="sr-only">
            Name
          </label>
          <input
            ref={nameRef}
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
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${id}-name-error` : undefined}
          />
          <FieldError id={`${id}-name-error`} message={nameError} />
        </div>
        <div>
          <label htmlFor={`${id}-description`} className="sr-only">
            Description
          </label>
          <textarea
            id={`${id}-description`}
            className={inputClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="Description (optional)"
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
          onEnter={save}
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={onDone} disabled={mutation.isPending}>
            Cancel
          </Button>
          <FieldError id={`${id}-error`} message={generalError} />
        </div>
      </div>
    </li>
  );
}
