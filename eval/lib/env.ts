/**
 * Loads .env.local before anything else.
 *
 * Several modules under lib/ construct API clients at import time
 * (`lib/ingestion/embedder.ts` builds an OpenAI client on the first line), so a
 * `dotenv.config()` call inside a script body runs too late — imports are
 * evaluated first. Importing this module ahead of them fixes the ordering.
 */
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL missing — run eval scripts from the repo root.')
}
