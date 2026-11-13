import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { CalendarDays, Dumbbell, Flame, ListChecks, Play, type LucideIcon } from 'lucide-react';
import { StartWorkoutDialog } from '../workouts/StartWorkoutDialog';
import { buttonClass, focusRing } from './ui';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Progress', icon: CalendarDays, end: true },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: ListChecks },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium motion-safe:transition-colors ${focusRing} ` +
  (isActive ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-muted hover:bg-sunken hover:text-ink');

export function Layout() {
  const [starting, setStarting] = useState(false);
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className={`sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 ${focusRing}`}>
        Skip to content
      </a>
      <aside className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur md:h-screen md:w-60 md:shrink-0 md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:px-4 md:py-6">
        <Link to="/" className={`flex items-center gap-2.5 rounded-lg px-1 py-1 md:mb-8 md:px-2 ${focusRing}`}>
          <span className="grid size-8 place-items-center rounded-[10px] bg-linear-to-br from-brand to-brand-2 text-white shadow-brand">
            <Flame className="size-4.5" aria-hidden="true" />
          </span>
          <span className="hidden text-lg font-bold tracking-tight md:inline">Workout Tracker</span>
          <span className="sr-only md:hidden">Workout Tracker</span>
        </Link>
        <nav aria-label="Main" className="flex gap-1 md:flex-col">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={navClass} title={label}>
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />
              <span className="sr-only md:not-sr-only">{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={() => setStarting(true)} className={buttonClass('primary', 'ml-auto md:mt-6 md:ml-0')}>
          <Play className="size-4 fill-current" aria-hidden="true" />
          <span className="sr-only md:not-sr-only">Start workout</span>
        </button>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-[880px]">
          <Outlet />
        </div>
      </main>
      <StartWorkoutDialog open={starting} onClose={() => setStarting(false)} />
    </div>
  );
}
