import { useEffect, useState, type KeyboardEvent } from 'react';
import { formatShortDuration } from '../time';
import { FieldError, inputClass } from './ui';

/** Parses a whole number of seconds; null if empty/invalid. */
export function parseSeconds(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  return Number(t);
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  error?: string | undefined;
  hint?: string;
  onEnter?: () => void;
}

/** Labelled seconds input for forms. Shows a friendly reading (e.g. "1m 30s") beside it. */
export function SecondsField({ id, label, value, onChange, min, max, error, hint, onEnter }: FieldProps) {
  const seconds = parseSeconds(value);
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          className={inputClass + ' w-28'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        <span className="text-sm text-zinc-500">
          seconds{seconds !== null && seconds >= 60 ? ` (${formatShortDuration(seconds)})` : ''}
        </span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-zinc-500">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface InlineProps {
  value: number;
  /** Called with a valid new value when the user commits (Enter or leaving the field). */
  onCommit: (value: number) => void;
  min: number;
  max: number;
  label: string;
  disabled?: boolean;
  custom?: boolean;
}

/** Compact seconds editor that commits on Enter/blur and reverts invalid input. */
export function InlineSeconds({ value, onCommit, min, max, label, disabled, custom }: InlineProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const n = parseSeconds(draft);
    if (n === null || n < min || n > max) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  }
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape' && draft !== String(value)) {
      e.preventDefault();
      e.stopPropagation(); // revert the field rather than closing a surrounding dialog
      setDraft(String(value));
    }
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label={label}
        title={`${label} (Enter to save)`}
        className={
          'w-16 rounded-md border bg-white px-2 py-1 text-right tabular-nums focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none disabled:opacity-50 dark:bg-zinc-900 ' +
          (custom
            ? 'border-indigo-400 text-indigo-700 dark:border-indigo-500 dark:text-indigo-300'
            : 'border-zinc-300 dark:border-zinc-700')
        }
      />
      <span className="text-zinc-500">s</span>
    </span>
  );
}
