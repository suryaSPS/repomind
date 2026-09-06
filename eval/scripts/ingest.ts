/**
 * Standalone ingestion for evaluation corpora.
 *
 * The production path (`POST /api/ingest`) is behind NextAuth and streams
 * progress to a browser. Evaluation needs the same pipeline driven from a
 * terminal, over a fixed list of repos, so this reuses `ingestRepo` directly
 * and manages the `repos` row itself.
 *
 * Run: npx tsx eval/scripts/ingest.ts [--force]
 */
import '../lib/env'

import { db, pool } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { ingestRepo } from '@/lib/ingestion'
import { CORPUS } from '../corpus'

const force = process.argv.includes('--force')

async function ensureRepoRow(url: string, owner: string, name: string) {
  const [existing] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.url, url)))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(repos)
    // userId stays null: authz treats null-owner repos as shared, which is what
    // an evaluation corpus and a public demo both want.
    .values({ url, owner, name, userId: null, status: 'pending' })
    .returning()
  return created
}

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    console.warn('⚠  GITHUB_TOKEN not set — GitHub API allows only 60 req/hr anonymously.')
  }

  for (const entry of CORPUS) {
    const row = await ensureRepoRow(entry.url, entry.owner, entry.name)
    const label = `${entry.owner}/${entry.name}`

    if (row.status === 'ready' && !force) {
      console.log(`✓ ${label} already ready (${row.fileCount} files, ${row.commitCount} commits) — skipping`)
      continue
    }

    console.log(`\n▶ Ingesting ${label} (repo id ${row.id})`)
    const started = Date.now()
    let lastPct = -1

    try {
      await ingestRepo(row.id, entry.url, (p) => {
        if (p.percent !== lastPct) {
          lastPct = p.percent
          process.stdout.write(`\r  ${String(p.percent).padStart(3)}%  ${p.stage}${p.detail ? ` — ${p.detail}` : ''}`.padEnd(100))
        }
      }, process.env.GITHUB_TOKEN ?? null)

      const secs = ((Date.now() - started) / 1000).toFixed(1)
      console.log(`\n✓ ${label} ingested in ${secs}s`)
    } catch (err) {
      console.error(`\n✗ ${label} failed:`, err instanceof Error ? err.message : err)
    }
  }

  await pool.end()
}

main()
