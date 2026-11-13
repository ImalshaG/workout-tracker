import { DEFAULT_DB_PATH, openDb } from './index.js';

openDb().$client.close();
console.log(`Migrations applied to ${DEFAULT_DB_PATH}`);
