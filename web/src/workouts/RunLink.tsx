import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { buttonClass } from '../components/ui';

/** "Start" as a link to the timer; rendered inert when there's nothing to run. */
export function RunLink({ workoutId, exerciseCount, className = '' }: { workoutId: number; exerciseCount: number; className?: string }) {
  const content = (
    <>
      <Play className="size-4 fill-current" aria-hidden="true" />
      Start
    </>
  );
  if (exerciseCount === 0) {
    return (
      <span className={buttonClass('primary', 'cursor-not-allowed opacity-50 ' + className)} title="Add exercises to run this workout" aria-disabled="true">
        {content}
      </span>
    );
  }
  return (
    <Link to={`/workouts/${workoutId}/run`} className={buttonClass('primary', className)}>
      {content}
    </Link>
  );
}
