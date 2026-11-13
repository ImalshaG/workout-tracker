import { hc, type ClientResponse, type InferResponseType } from 'hono/client';
// Type-only import: no server code is bundled into the web app.
import type { AppType } from '../../../server/src/app';

export const client = hc<AppType>('/');

export type { InferResponseType };

/** An API failure in the server's `{ error: { code, message, field? } }` shape. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

type SuccessStatus = 200 | 201;
/** The JSON body type of the 2xx members of a typed Hono response union. */
type OkBody<R> = R extends ClientResponse<infer T, infer S, string> ? (S extends SuccessStatus ? T : never) : never;

export async function throwApiError(res: Response): Promise<never> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // non-JSON error (e.g. the dev proxy can't reach the API)
  }
  const err = (body as { error?: { code?: string; message?: string; field?: string } } | undefined)?.error;
  throw new ApiRequestError(
    res.status,
    err?.code ?? 'INTERNAL_ERROR',
    err?.message ?? `Request failed (${res.status})`,
    err?.field,
  );
}

export async function unwrap<R extends ClientResponse<unknown, number, string>>(res: R): Promise<OkBody<R>> {
  if (!res.ok) return throwApiError(res);
  return (await res.json()) as OkBody<R>;
}

/** Splits an error into a message for a specific field, or a general one. */
export function errorFor<F extends string>(
  error: unknown,
  fields: readonly F[] = [],
): { field?: F; code?: string; message: string } | null {
  if (!error) return null;
  if (error instanceof ApiRequestError) {
    const field = fields.find((f) => f === error.field);
    if (field) return { field, code: error.code, message: error.message };
    if (error.code === 'INTERNAL_ERROR') return { message: 'Something went wrong. Please try again.' };
    return { code: error.code, message: error.message };
  }
  return { message: "Couldn't reach the server. Is it running?" };
}
