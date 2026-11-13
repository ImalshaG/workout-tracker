import { expect } from 'vitest';
import { createApp } from '../app.js';
import { openDb } from '../db/index.js';

export type Json = Record<string, unknown>;

/** Fresh app on an in-memory DB with a controllable clock. */
export function setup() {
  const ctx = {
    clock: 1_700_000_000_000,
    app: undefined as unknown as ReturnType<typeof createApp>,
  };
  ctx.app = createApp({ db: openDb(':memory:'), now: () => ctx.clock });

  const send = (method: string, path: string, body?: unknown) =>
    ctx.app.request(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function sendOk<T = Json>(method: string, path: string, body: unknown, status: number): Promise<T> {
    const res = await send(method, path, body);
    if (res.status !== status) throw new Error(`${method} ${path} -> ${res.status}: ${await res.text()}`);
    return (await res.json()) as T;
  }

  return { ctx, send, sendOk };
}

export async function expectError(res: Response, status: number, code: string, field?: string) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { error: Json };
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  if (field) expect(body.error.field).toBe(field);
  return body.error;
}
