import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { NotFound } from './components/NotFound';
import { ExerciseLibrary } from './exercises/ExerciseLibrary';
import { ProgressPage } from './progress/ProgressPage';
import { RunWorkoutPage } from './run/RunWorkoutPage';
import { WorkoutDetailPage } from './workouts/WorkoutDetailPage';
import { WorkoutsPage } from './workouts/WorkoutsPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ProgressPage />} />
        <Route path="workouts" element={<WorkoutsPage />} />
        <Route path="workouts/:id" element={<WorkoutDetailPage />} />
        <Route path="workouts/:id/run" element={<RunWorkoutPage />} />
        <Route path="exercises" element={<ExerciseLibrary />} />
        <Route path="calendar" element={<OldCalendarRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** The progress page used to live at /calendar; keep old links (and their ?month=&day=) working. */
function OldCalendarRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/', search }} replace />;
}
