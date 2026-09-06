/**
 * Builds (or drops) the HNSW index on code_chunks.embedding.
 *
 * There is no vector index on this table today, so every semantic search is an
 * exact sequential scan of every chunk in the repo. That is correct and, at a
 * few hundred chunks, fast. The question this script exists to answer is what
 * it costs at 12k chunks, and what an approximate index gives back — HNSW
 * trades exactness for speed, so the recall it loses has to be measured, not
 * assumed.
 *
 * Run: npx tsx eval/scripts/setup-hnsw.ts [--drop]
 */
import '../lib/env'
import { pool } from '@/lib/db'

async function main() {
  if (process.argv.includes('--drop')) {
    await pool.query('DROP INDEX IF EXISTS code_chunks_embedding_hnsw')
    console.log('✓ HNSW index dropped — searches are exact again')
    await pool.end()
    return
  }

  console.log('▶ Building HNSW index (cosine)…')
  const started = Date.now()
  // m=16, ef_construction=64 are pgvector's defaults: the usual starting point,
  // and the point of the exercise is the exact-vs-approximate tradeoff rather
  // than a tuning sweep.
  await pool.query(
    `CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw
     ON code_chunks USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64)`
  )
  console.log(`✓ built in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  const { rows } = await pool.query(
    `SELECT pg_size_pretty(pg_relation_size('code_chunks_embedding_hnsw')) AS size`
  )
  console.log(`  index size: ${rows[0].size}`)
  await pool.end()
}

main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1) })
