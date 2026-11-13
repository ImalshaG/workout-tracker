import { client, throwApiError, unwrap, type InferResponseType } from './client';

const api = client.api.runs;

export type Run = InferResponseType<typeof api.$get, 200>[number];

export const runKeys = {
  all: ['runs'] as const,
  range: (from: number, to: number) => ['runs', from, to] as const,
  days: (tz: string) => ['runs', 'days', tz] as const,
  allRuns: () => ['runs', 'all'] as const,
};

/** Completed runs, optionally limited to `completedAt` in [from, to). */
export async function listRuns(from?: number, to?: number): Promise<Run[]> {
  const query: { from?: string; to?: string } = {};
  if (from !== undefined) query.from = String(from);
  if (to !== undefined) query.to = String(to);
  return unwrap(await api.$get({ query }));
}

export async function logRun(workoutId: number, startedAt: number): Promise<Run> {
  return unwrap(await api.$post({ json: { workoutId, startedAt } }));
}

export async function deleteRun(id: number): Promise<void> {
  const res = await api[':id'].$delete({ param: { id: String(id) } });
  if (!res.ok) await throwApiError(res);
}

/** The browser's IANA time zone, so the server buckets runs into the same days the user sees. */
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Every "YYYY-MM-DD" (in `tz`) with at least one completed run. */
export async function listRunDays(tz: string): Promise<string[]> {
  return unwrap(await api.days.$get({ query: { tz } }));
}
