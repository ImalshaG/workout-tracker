import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { exerciseKeys, listExercises, type Exercise } from '../api/exercises';
import { Plus } from 'lucide-react';
import { Badge, Button, LoadError, StatusLine } from '../components/ui';
import { formatShortDuration } from '../time';
import { SortableExerciseList } from './SortableExerciseList';

export interface Selected {
  key: number;
  exercise: Exercise;
  /** Duration for this entry if different from the exercise default. */
  overrideSeconds: number | null;
}

export const effectiveSeconds = (s: Selected) => s.overrideSeconds ?? s.exercise.durationSeconds;

/** What to send to the API: plain ids, or objects for entries with an override. */
export const toExerciseItems = (selected: Selected[]) =>
  selected.map((s) => (s.overrideSeconds === null ? s.exercise.id : { exerciseId: s.exercise.id, durationSeconds: s.overrideSeconds }));

interface Props {
  selected: Selected[];
  onChange: (selected: Selected[]) => void;
  /** Heading for the chosen list, e.g. "Exercises in this workout". */
  selectedLabel: string;
  emptyHint: string;
}

/**
 * Pick exercises from the library into an ordered, editable list.
 * The same exercise can be added more than once; each addition is its own entry.
 */
export function ExerciseSelection({ selected, onChange, selectedLabel, emptyHint }: Props) {
  const nextKey = useRef(1);
  const counts = new Map<number, number>();
  for (const s of selected) counts.set(s.exercise.id, (counts.get(s.exercise.id) ?? 0) + 1);

  return (
    <div className="space-y-5">
      <section aria-label={selectedLabel}>
        <h3 className="text-sm font-semibold">
          {selectedLabel} <span className="font-normal text-muted">({selected.length})</span>
        </h3>
        {selected.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            {emptyHint}
          </p>
        ) : (
          <SortableExerciseList
            label={selectedLabel}
            items={selected.map((s) => ({
              key: s.key,
              name: s.exercise.name,
              description: s.exercise.description,
              duration: {
                seconds: effectiveSeconds(s),
                defaultSeconds: s.exercise.durationSeconds,
                custom: s.overrideSeconds !== null,
              },
            }))}
            onReorder={(keys) => onChange(keys.map((k) => selected.find((s) => s.key === k)!))}
            onRemove={(key) => onChange(selected.filter((s) => s.key !== key))}
            onDurationChange={(key, seconds) =>
              onChange(selected.map((s) => (s.key === key ? { ...s, overrideSeconds: seconds } : s)))
            }
          />
        )}
      </section>
      <ExercisePicker
        counts={counts}
        onAdd={(exercise) => onChange([...selected, { key: nextKey.current++, exercise, overrideSeconds: null }])}
      />
    </div>
  );
}

function ExercisePicker({ counts, onAdd }: { counts: Map<number, number>; onAdd: (exercise: Exercise) => void }) {
  const query = useQuery({ queryKey: exerciseKeys.all, queryFn: listExercises });

  return (
    <section aria-label="Exercise library">
      <h3 className="text-sm font-semibold">Exercise library</h3>
      {query.isPending ? (
        <StatusLine>Loading exercises…</StatusLine>
      ) : query.isError ? (
        <LoadError what="exercises" onRetry={() => query.refetch()} retrying={query.isFetching} />
      ) : query.data.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Your exercise library is empty.{' '}
          <Link to="/exercises" className="font-semibold text-brand-ink hover:underline">
            Add exercises
          </Link>{' '}
          first.
        </p>
      ) : (
        <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {query.data.map((exercise) => {
            const count = counts.get(exercise.id) ?? 0;
            return (
              <li key={exercise.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm break-words">
                    <span className="font-medium">{exercise.name}</span>{' '}
                    <span className="text-xs text-muted tabular-nums">{formatShortDuration(exercise.durationSeconds)}</span>
                  </p>
                  {exercise.description && (
                    <p className="truncate text-xs text-muted">{exercise.description}</p>
                  )}
                </div>
                {count > 0 && (
                  <Badge>Added{count > 1 ? ` ×${count}` : ''}</Badge>
                )}
                <Button size="sm" icon={Plus} onClick={() => onAdd(exercise)} aria-label={`Add ${exercise.name}`}>
                  {count > 0 ? 'Add again' : 'Add'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
