import type { ComponentProps, ReactNode } from 'react';

export const inputClass =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
  'aria-[invalid=true]:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600',
  secondary:
    'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 focus-visible:outline-indigo-600 ' +
    'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600',
  ghostDanger:
    'text-red-700 hover:bg-red-50 focus-visible:outline-red-600 dark:text-red-400 dark:hover:bg-red-950',
  ghost:
    'text-zinc-700 hover:bg-zinc-100 focus-visible:outline-indigo-600 dark:text-zinc-300 dark:hover:bg-zinc-800',
} as const;

export type ButtonVariant = keyof typeof variants;

/** Button styling, also usable on links that should look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', extra = '') {
  return (
    'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 ' +
    variants[variant] +
    ' ' +
    extra
  );
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

/** Round "+" button used for the primary create action on a page. */
export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}

export function PageHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      <h1 className="min-w-0 text-2xl font-bold tracking-tight break-words">{title}</h1>
      {action}
    </header>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-zinc-500" role="status">
      {children}
    </p>
  );
}

export function LoadError({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex items-center gap-3 py-6" role="alert">
      <p className="text-red-600 dark:text-red-400">Couldn't load {what}.</p>
      <Button onClick={onRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
