import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, PageHeader } from '../components/ui';
import { usePageTitle } from '../usePageTitle';
import { AddExerciseDialog } from './AddExerciseDialog';
import { ExerciseList } from './ExerciseList';

export function ExerciseLibrary() {
  usePageTitle('Exercises');
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Exercise library"
        subtitle="The moves you build workouts from."
        action={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            New exercise
          </Button>
        }
      />
      <section aria-label="Exercises">
        <ExerciseList onAdd={() => setAdding(true)} />
      </section>
      <AddExerciseDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
