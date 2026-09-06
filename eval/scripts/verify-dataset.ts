/**
 * Checks every ground-truth label against the index.
 *
 * A label naming a file that was never indexed is not a hard question — it is
 * an unanswerable one, and it would silently drag every retriever's recall down
 * by the same amount, which looks like a corpus being "hard" rather than a
 * dataset being wrong.
 *
 * Run: npx tsx eval/scripts/verify-dataset.ts
 */
import '../lib/env'
import { pool } from '@/lib/db'
import { loadDataset, groupByRepo } from '../lib/dataset'
import { CORPUS } from '../corpus'

async function main() {
  const queries = loadDataset()
  const byRepo = groupByRepo(queries)
  let problems = 0

  for (const [repoKey, repoQueries] of byRepo) {
    const entry = CORPUS.find((c) => c.key === repoKey)
    if (!entry) {
      console.error(`✗ ${repoKey}: not in corpus.ts`)
      problems++
      continue
    }

    const { rows: repoRows } = await pool.query(
      `SELECT id FROM repos WHERE url = $1 AND status = 'ready'`,
      [entry.url]
    )
    if (repoRows.length === 0) {
      console.error(`✗ ${repoKey}: no repo row with status 'ready'`)
      problems++
      continue
    }
    const repoId = repoRows[0].id

    const { rows: fileRows } = await pool.query(
      `SELECT DISTINCT file_path FROM code_chunks WHERE repo_id = $1`,
      [repoId]
    )
    const indexed = new Set(fileRows.map((r: { file_path: string }) => r.file_path))

    const ids = new Set<string>()
    let bad = 0

    for (const q of repoQueries) {
      if (ids.has(q.id)) {
        console.error(`✗ duplicate query id: ${q.id}`)
        problems++
      }
      ids.add(q.id)

      if (q.relevantFiles.length === 0) {
        console.error(`✗ ${q.id}: no relevant files labelled`)
        problems++
        bad++
      }

      for (const f of q.relevantFiles) {
        if (!indexed.has(f)) {
          console.error(`✗ ${q.id}: labelled file not in index — ${f}`)
          problems++
          bad++
        }
      }
    }

    const status = bad === 0 ? '✓' : '✗'
    console.log(
      `${status} ${repoKey.padEnd(10)} repo ${String(repoId).padEnd(3)} ` +
      `${String(repoQueries.length).padStart(3)} queries, ${indexed.size} indexed files`
    )
  }

  console.log(problems === 0 ? '\n✅ All labels resolve to indexed files.' : `\n❌ ${problems} problem(s).`)
  await pool.end()
  process.exit(problems === 0 ? 0 : 1)
}

main()
