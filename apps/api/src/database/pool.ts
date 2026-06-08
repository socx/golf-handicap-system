import { Pool } from 'pg';
import { env } from '../config/env';

// Single shared Postgres pool for the API process.
export const dbPool = new Pool({ connectionString: env.dbUrl });
