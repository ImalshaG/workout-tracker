import { useState } from 'react';
import { AddButton, PageHeader } from '../components/ui';
import { usePageTitle } from '../usePageTitle';
import { AddExerciseDialog } from './AddExerciseDialog';
import { ExerciseList } from './ExerciseList';

export function ExerciseLibrary() {
  usePageTitle('Exercises');
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader title="Exercise library" action={<AddButton label="Add exercise" onClick={() => setAdding(true)} />} />
      <section aria-label="Exercises">
        <ExerciseList />
      </section>
      <AddExerciseDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
