import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { openDb } from './db/index.js';

type Json = Record<string, unknown>;

let clock: number;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  clock = 1_700_000_000_000;
  app = createApp({ db: openDb(':memory:'), now: () => clock });
});

function send(method: string, path: string, body?: unknown) {
  return app.request(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function create(body: Json) {
  const res = await send('POST', '/api/exercises', body);
  expect(res.status).toBe(201);
  return (await res.json()) as Json & { id: number };
}

async function list() {
  const res = await send('GET', '/api/exercises');
  expect(res.status).toBe(200);
  return (await res.json()) as Json[];
}

async function expectError(res: Response, status: number, code: string, field?: string) {
  expect(res.status).toBe(status);
  const body = (await res.json()) as { error: Json };
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  if (field) expect(body.error.field).toBe(field);
}

describe('GET /api/exercises', () => {
  it('returns an empty array initially', async () => {
    expect(await list()).toEqual([]);
  });

  it('sorts by name ignoring case', async () => {
    for (const name of ['squat', 'Bench press', 'deadlift', 'Arnold press']) await create({ name });
    expect((await list()).map((e) => e.name)).toEqual(['Arnold press', 'Bench press', 'deadlift', 'squat']);
  });
});

describe('POST /api/exercises', () => {
  it('creates with a description', async () => {
    const ex = await create({ name: 'Squat', description: 'Back squat' });
    expect(ex).toEqual({
      id: expect.any(Number),
      name: 'Squat',
      description: 'Back squat',
      durationSeconds: 30,
      createdAt: clock,
      updatedAt: clock,
    });
    expect(await list()).toEqual([ex]);
  });

  it('creates without a description', async () => {
    const ex = await create({ name: 'Squat' });
    expect(ex.description).toBeNull();
  });

  it('trims name and description', async () => {
    const ex = await create({ name: '  Squat  ', description: '  Deep  ' });
    expect(ex.name).toBe('Squat');
    expect(ex.description).toBe('Deep');
  });

  it.each(['', '   '])('stores empty/whitespace description %j as null', async (description) => {
    const ex = await create({ name: 'Squat', description });
    expect(ex.description).toBeNull();
  });

  it('accepts a null description', async () => {
    const ex = await create({ name: 'Squat', description: null });
    expect(ex.description).toBeNull();
  });

  it('accepts boundary lengths', async () => {
    const ex = await create({ name: 'n'.repeat(100), description: 'd'.repeat(1000) });
    expect((ex.name as string).length).toBe(100);
  });

  it.each([
    ['missing name', {}],
    ['empty name', { name: '' }],
    ['whitespace name', { name: '   ' }],
    ['too-long name', { name: 'n'.repeat(101) }],
    ['non-string name', { name: 42 }],
  ])('400 for %s', async (_label, body) => {
    await expectError(await send('POST', '/api/exercises', body), 400, 'VALIDATION_ERROR', 'name');
  });

  it('400 for too-long description', async () => {
    const res = await send('POST', '/api/exercises', { name: 'Squat', description: 'd'.repeat(1001) });
    await expectError(res, 400, 'VALIDATION_ERROR', 'description');
  });

  it('400 for a malformed JSON body', async () => {
    const res = await app.request('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    await expectError(res, 400, 'VALIDATION_ERROR');
  });

  it('409 for an exact duplicate name', async () => {
    await create({ name: 'Squat' });
    await expectError(await send('POST', '/api/exercises', { name: 'Squat' }), 409, 'NAME_TAKEN', 'name');
  });

  it('409 for a duplicate differing only in case (and whitespace)', async () => {
    await create({ name: 'Squat' });
    await expectError(await send('POST', '/api/exercises', { name: ' sQUAT ' }), 409, 'NAME_TAKEN', 'name');
    expect(await list()).toHaveLength(1);
  });
});

describe('PUT /api/exercises/:id', () => {
  it('replaces both fields; updatedAt changes, createdAt does not', async () => {
    const ex = await create({ name: 'Squat', description: 'Old' });
    clock += 5_000;
    const res = await send('PUT', `/api/exercises/${ex.id}`, { name: ' Front squat ', description: ' New ' });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as Json;
    expect(updated).toEqual({
      id: ex.id,
      name: 'Front squat',
      description: 'New',
      durationSeconds: 30,
      createdAt: ex.createdAt,
      updatedAt: clock,
    });
    expect(updated.updatedAt).not.toBe(ex.updatedAt);
    expect(await list()).toEqual([updated]);
  });

  it('clears the description when omitted', async () => {
    const ex = await create({ name: 'Squat', description: 'Old' });
    const res = await send('PUT', `/api/exercises/${ex.id}`, { name: 'Squat' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).description).toBeNull();
  });

  it('allows renaming to the same name with different capitals', async () => {
    const ex = await create({ name: 'squat' });
    const res = await send('PUT', `/api/exercises/${ex.id}`, { name: 'Squat' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).name).toBe('Squat');
  });

  it('409 when renaming to another exercise name (ignoring case)', async () => {
    await create({ name: 'Squat' });
    const ex = await create({ name: 'Deadlift' });
    await expectError(await send('PUT', `/api/exercises/${ex.id}`, { name: 'SQUAT' }), 409, 'NAME_TAKEN', 'name');
  });

  it('400 with field for invalid input', async () => {
    const ex = await create({ name: 'Squat' });
    await expectError(await send('PUT', `/api/exercises/${ex.id}`, { name: '' }), 400, 'VALIDATION_ERROR', 'name');
    await expectError(
      await send('PUT', `/api/exercises/${ex.id}`, { name: 'Squat', description: 'd'.repeat(1001) }),
      400,
      'VALIDATION_ERROR',
      'description',
    );
  });

  it('404 for a missing id', async () => {
    await expectError(await send('PUT', '/api/exercises/999', { name: 'Squat' }), 404, 'NOT_FOUND');
  });

  it.each(['abc', '1.5', '-1', '0', '12abc'])('400 for non-numeric/invalid id %j', async (id) => {
    await expectError(await send('PUT', `/api/exercises/${id}`, { name: 'Squat' }), 400, 'VALIDATION_ERROR', 'id');
  });
});

describe('DELETE /api/exercises/:id', () => {
  it('deletes and returns 204', async () => {
    const ex = await create({ name: 'Squat' });
    const res = await send('DELETE', `/api/exercises/${ex.id}`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await list()).toEqual([]);
  });

  it('404 for a missing id', async () => {
    await expectError(await send('DELETE', '/api/exercises/999'), 404, 'NOT_FOUND');
  });

  it('400 for a non-numeric id', async () => {
    await expectError(await send('DELETE', '/api/exercises/abc'), 400, 'VALIDATION_ERROR', 'id');
  });
});

describe('errors', () => {
  it('returns NOT_FOUND for unknown API routes', async () => {
    await expectError(await send('GET', '/api/nope'), 404, 'NOT_FOUND');
  });
});
