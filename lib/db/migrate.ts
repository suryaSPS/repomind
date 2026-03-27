/**
 * Run with: npx tsx lib/db/migrate.ts
 * This creates all tables and installs pgvector, then seeds users from .env
 */
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const db = drizzle(pool)

  // Enable pgvector extension
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector')
  console.log('✓ pgvector extension enabled')

  // Run Drizzle migrations
  await migrate(db, { migrationsFolder: './lib/db/migrations' })
  console.log('✓ Migrations applied')

  // Seed users from SEED_USERS env var
  const seedUsers = process.env.SEED_USERS
  if (seedUsers) {
    const pairs = seedUsers.split(',').map((s) => s.trim())
    for (const pair of pairs) {
      const [username, password] = pair.split(':')
      if (!username || !password) continue
      const passwordHash = await bcrypt.hash(password, 12)
      await pool.query(
        `INSERT INTO users (username, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (username) DO NOTHING`,
        [username, passwordHash]
      )
      console.log(`✓ Seeded user: ${username}`)
    }
  }

  await pool.end()
  console.log('\n✅ Database ready!')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
