import { Link } from 'react-router';
import { buttonClass } from '../components/ui';

/** "Run" as a link; rendered inert when there's nothing to run. */
export function RunLink({ workoutId, exerciseCount, compact = false }: { workoutId: number; exerciseCount: number; compact?: boolean }) {
  const label = compact ? 'Run' : '▶ Run';
  if (exerciseCount === 0) {
    return (
      <span className={buttonClass('primary', 'cursor-not-allowed opacity-50')} title="Add exercises to run this workout" aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <Link to={`/workouts/${workoutId}/run`} className={buttonClass('primary')}>
      {label}
    </Link>
  );
}
