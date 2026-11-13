import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink shadow-xs placeholder:text-muted ' +
  'focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand/25 aria-[invalid=true]:border-red-500';

const variants = {
  primary: 'bg-brand-fill text-white shadow-brand hover:bg-brand-fill-hover',
  secondary: 'border border-line bg-surface text-ink shadow-xs hover:bg-sunken',
  ghost: 'text-ink/80 hover:bg-sunken hover:text-ink',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghostDanger: 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60',
} as const;
export type ButtonVariant = keyof typeof variants;

const sizes = { sm: 'gap-1.5 px-2.5 py-1 text-sm', md: 'gap-2 px-3.5 py-2 text-sm' } as const;

/** Button styling, also usable on links that should look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', extra = '', size: keyof typeof sizes = 'md') {
  return [
    'inline-flex items-center justify-center rounded-[10px] font-semibold whitespace-nowrap',
    'motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    focusRing, sizes[size], variants[variant], extra,
  ].join(' ');
}

export function Button({
  variant = 'secondary', size = 'md', icon: Icon, className = '', type = 'button', children, ...props
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: keyof typeof sizes; icon?: LucideIcon }) {
  return (
    <button type={type} className={buttonClass(variant, className, size)} {...props}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Square icon-only button; `label` is its accessible name and tooltip. */
export function IconButton({
  label, icon: Icon, variant = 'ghost', className = '', type = 'button', ...props
}: ComponentProps<'button'> & { label: string; icon: LucideIcon; variant?: 'ghost' | 'ghostDanger' }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-[10px] motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className="size-4.5" aria-hidden="true" />
    </button>
  );
}

const paddings = { none: '', sm: 'p-3', md: 'p-5' } as const;

export function Card({
  as: Tag = 'div', padding = 'md', className = '', ...props
}: ComponentProps<'div'> & { as?: 'div' | 'section' | 'li' | 'article'; padding?: keyof typeof paddings }) {
  return <Tag className={`rounded-card border border-line bg-surface shadow-card ${paddings[padding]} ${className}`} {...(props as object)} />;
}

export function Badge({ icon: Icon, tone = 'brand', children }: { icon?: LucideIcon; tone?: 'brand' | 'neutral'; children: ReactNode }) {
  const toneClass = tone === 'brand' ? 'bg-brand-soft text-brand-ink' : 'bg-sunken text-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${toneClass}`}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatCard({ label, value, note, highlight = false, testId }: {
  label: string; value: ReactNode; note?: string | undefined; highlight?: boolean; testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={
        'rounded-card border px-4 py-3 shadow-card ' +
        (highlight
          ? 'border-orange-200 bg-linear-to-br from-orange-50 to-amber-100 dark:border-orange-900 dark:from-orange-950/60 dark:to-amber-950/40'
          : 'border-line bg-surface')
      }
    >
      <dt className="text-[11px] font-semibold tracking-wider text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-display text-3xl leading-none font-bold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs leading-tight text-muted">{note}</dd>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1 text-sm text-red-700 dark:text-red-400">{message}</p>;
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight break-words">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function StatusLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-muted" role="status">{children}</p>;
}

export function LoadError({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/40" role="alert">
      <p className="flex-1 text-red-800 dark:text-red-300">Couldn't load {what}.</p>
      <Button onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying…' : 'Retry'}</Button>
    </div>
  );
}
