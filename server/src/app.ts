import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { HTTPException } from 'hono/http-exception';
import type { Db } from './db/index.js';
import { apiError } from './errors.js';
import { exerciseRoutes } from './routes/exercises.js';
import { runRoutes } from './routes/runs.js';
import { workoutRoutes } from './routes/workouts.js';

export interface AppOptions {
  db: Db;
  /** Clock for timestamps (Unix ms); injectable for tests. */
  now?: () => number;
  /** When set, serves the built web UI from this directory (production). */
  staticDir?: string;
}

function buildApi(db: Db, now: () => number) {
  return new Hono()
    .route('/api/exercises', exerciseRoutes(db, now))
    .route('/api/workouts', workoutRoutes(db, now))
    .route('/api/runs', runRoutes(db, now));
}

/** Type of the API, for the typed Hono client in web/. */
export type AppType = ReturnType<typeof buildApi>;

export function createApp({ db, now = Date.now, staticDir }: AppOptions) {
  const app = buildApi(db, now);

  if (staticDir) {
    app.use('*', serveStatic({ root: staticDir }));
    // SPA fallback: any non-API GET serves index.html.
    app.get('*', (c, next) =>
      c.req.path.startsWith('/api/') ? next() : serveStatic({ root: staticDir, path: 'index.html' })(c, next),
    );
  }

  app.notFound((c) => c.json(apiError('NOT_FOUND', 'Not found'), 404));

  app.onError((err, c) => {
    if (err instanceof HTTPException && err.status === 400) {
      // e.g. malformed JSON body
      return c.json(apiError('VALIDATION_ERROR', err.message || 'Invalid request body'), 400);
    }
    console.error(err);
    return c.json(apiError('INTERNAL_ERROR', 'Something went wrong'), 500);
  });

  return app;
}
