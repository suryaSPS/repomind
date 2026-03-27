import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

// Singleton pool — reuse across hot reloads in dev
const globalForPg = global as unknown as { pgPool: Pool }

const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPool = pool
}

export const db = drizzle(pool, { schema })
export { pool }
