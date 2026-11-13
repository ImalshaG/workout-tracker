import { NavLink, Outlet } from 'react-router';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
  (isActive
    ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100');

export function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <nav aria-label="Main" className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-[720px] items-center gap-1 px-4 py-3">
          <NavLink to="/" end className={linkClass}>
            Your progress
          </NavLink>
          <NavLink to="/workouts" className={linkClass}>
            Workouts
          </NavLink>
          <NavLink to="/exercises" className={linkClass}>
            Exercises
          </NavLink>
        </div>
      </nav>
      <main className="mx-auto max-w-[720px] px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
