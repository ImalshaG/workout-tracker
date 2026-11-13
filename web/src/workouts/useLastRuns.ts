import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRuns, runKeys } from '../api/runs';
import { lastRunByWorkout } from './lastRun';

/** Latest completion per workout id; null while loading or if history can't be loaded (callers degrade quietly). */
export function useLastRuns(): Map<number, number> | null {
  const query = useQuery({ queryKey: runKeys.allRuns(), queryFn: () => listRuns() });
  return useMemo(() => (query.data ? lastRunByWorkout(query.data) : null), [query.data]);
}
