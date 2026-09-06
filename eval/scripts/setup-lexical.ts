/**
 * Adds the code-aware lexical index to `code_chunks`.
 *
 * Kept as an eval script rather than a Drizzle migration on purpose: it is an
 * experiment until the numbers justify it. If the hybrid retriever wins, this
 * graduates into lib/db/migrations and the production search path.
 *
 * The generated column indexes three things per chunk:
 *   1. the file path, and the path split on / . _ -
 *   2. the raw content (so `getGitHubToken` matches as one token)
 *   3. the content with camelCase and snake_case split apart
 *
 * 'simple' rather than 'english': English stemming mangles identifiers
 * (`routing` → `rout`) and its stopword list drops words that are meaningful in
 * code (`in`, `not`, `on`).
 *
 * Run: npx tsx eval/scripts/setup-lexical.ts
 */
import '../lib/env'
import { pool } from '@/lib/db'

const TSV_EXPRESSION = `
  to_tsvector('simple',
    coalesce(file_path, '') || ' ' ||
    regexp_replace(coalesce(file_path, ''), '[/._\\-]', ' ', 'g') || ' ' ||
    content || ' ' ||
    regexp_replace(
      regexp_replace(
        regexp_replace(content, '([a-z0-9])([A-Z])', '\\1 \\2', 'g'),
        '([A-Z]+)([A-Z][a-z])', '\\1 \\2', 'g'
      ),
      '[_./:\\-]', ' ', 'g'
    )
  )
`

async function main() {
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'code_chunks' AND column_name = 'content_tsv'`
  )

  if (existing.length === 0) {
    console.log('▶ Adding generated tsvector column (this rewrites the table)…')
    const started = Date.now()
    await pool.query(
      `ALTER TABLE code_chunks
       ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (${TSV_EXPRESSION}) STORED`
    )
    console.log(`✓ content_tsv added in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  } else {
    console.log('✓ content_tsv already present')
  }

  console.log('▶ Building GIN index…')
  const started = Date.now()
  await pool.query(
    `CREATE INDEX IF NOT EXISTS code_chunks_tsv_idx
     ON code_chunks USING GIN (content_tsv)`
  )
  console.log(`✓ GIN index ready in ${((Date.now() - started) / 1000).toFixed(1)}s`)

  const { rows } = await pool.query(
    `SELECT pg_size_pretty(pg_total_relation_size('code_chunks')) AS total,
            pg_size_pretty(pg_relation_size('code_chunks_tsv_idx')) AS tsv_index`
  )
  console.log(`  code_chunks total: ${rows[0].total}  (GIN index: ${rows[0].tsv_index})`)

  await pool.end()
}

main().catch(async (err) => {
  console.error(err)
  await pool.end()
  process.exit(1)
})
