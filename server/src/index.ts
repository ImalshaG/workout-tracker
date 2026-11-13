import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { openDb } from './db/index.js';

const PORT = Number(process.env.PORT ?? 3001);
const production = process.env.NODE_ENV === 'production';

// serveStatic's root is resolved against the CWD, so make it relative.
const webDist = relative(process.cwd(), fileURLToPath(new URL('../../web/dist', import.meta.url))) || '.';

// DB_PATH lets you point at another database file (e.g. a scratch one); defaults to server/data/workouts.db.
const db = openDb(process.env.DB_PATH || undefined);
const app = createApp({ db, ...(production ? { staticDir: webDist } : {}) });

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}${production ? ' (serving web UI)' : ''}`);
});

function shutdown() {
  server.close();
  db.$client.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
