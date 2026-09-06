/**
 * Sensitivity sweep for the test-file weight in the source-kind prior.
 *
 * The prior helps when the answer is implementation and hurts when the answer
 * really is a test. Picking one weight and reporting only the number it makes
 * look best would hide that trade; this sweeps the weight and reports both
 * sides of it, on both the tuned set (gold) and the held-out set (silver).
 *
 * Run: npx tsx eval/scripts/sweep-prior.ts
 */
import '../lib/env'
import fs from 'fs'
import path from 'path'
import { pool } from '@/lib/db'
import { embedBatch } from '@/lib/ingestion/embedder'
import { searchCodeChunks } from '@/lib/vector/search'
import { applySourcePrior, DEFAULT_WEIGHTS } from '@/lib/vector/source-prior'
import { loadDataset, type EvalQuery } from '../lib/dataset'
import { CORPUS } from '../corpus'
import { toFileRanking, ndcgAtK, recallAtK, reciprocalRank, mean } from '../lib/metrics'

const POOL = 40
const K = 10
const TEST_WEIGHTS = [1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.62, 0.5]

/**
 * Sweep every non-implementation kind together rather than test alone.
 * One knob — "how much is a non-implementation file discounted" — is easier to
 * justify and to tune than four independent constants fitted to a set of this
 * size.
 */
const UNIFORM = process.argv.includes('--uniform')

async function main() {
  const queries = loadDataset()
  const repoIds = new Map<string, number>()
  for (const entry of CORPUS) {
    const { rows } = await pool.query(
      `SELECT id FROM repos WHERE url = $1 AND status = 'ready' ORDER BY id DESC LIMIT 1`,
      [entry.url]
    )
    if (rows.length) repoIds.set(entry.key, rows[0].id)
  }

  const usable = queries.filter((q) => repoIds.has(q.repo))
  console.log(`Embedding ${usable.length} questions once, reused across all weights…`)

  const embeddings = new Map<string, number[]>()
  for (let i = 0; i < usable.length; i += 100) {
    const batch = usable.slice(i, i + 100)
    const vectors = await embedBatch(batch.map((q) => q.question))
    batch.forEach((q, j) => embeddings.set(q.id, vectors[j]))
  }

  // Retrieve the candidate pool once too — the weight only changes re-ordering,
  // so re-querying per weight would measure Postgres, not the prior.
  console.log('Retrieving candidate pools…')
  const pools = new Map<string, Awaited<ReturnType<typeof searchCodeChunks>>>()
  for (const q of usable) {
    pools.set(q.id, await searchCodeChunks(repoIds.get(q.repo)!, embeddings.get(q.id)!, POOL))
  }

  const slice = (predicate: (q: EvalQuery) => boolean) => usable.filter(predicate)
  const groups: [string, EvalQuery[]][] = [
    ['gold (all)', slice((q) => q.tier === 'gold')],
    ['silver: impl', slice((q) => q.tier === 'silver' && q.sourceKind === 'implementation')],
    ['silver: test', slice((q) => q.tier === 'silver' && q.sourceKind === 'test')],
    ['silver: config', slice((q) => q.tier === 'silver' && q.sourceKind === 'config')],
    ['silver (all)', slice((q) => q.tier === 'silver')],
  ]

  const rows: Record<string, Record<string, number>>[] = []

  console.log(`\nnDCG@10 as the ${UNIFORM ? 'non-implementation' : 'test-file'} weight varies (1.0 = no penalty)\n`)
  console.log('weight'.padEnd(10) + groups.map(([g]) => g.padEnd(16)).join(''))
  console.log('─'.repeat(10 + groups.length * 16))

  for (const testWeight of TEST_WEIGHTS) {
    const weights = UNIFORM
      ? { implementation: 1, test: testWeight, docs: testWeight, example: testWeight, config: testWeight }
      : { ...DEFAULT_WEIGHTS, test: testWeight }
    const row: Record<string, Record<string, number>> = {}

    const cells = groups.map(([label, qs]) => {
      const scores = qs.map((q) => {
        const ranked = applySourcePrior(pools.get(q.id)!, q.question, K, weights)
        const ranking = toFileRanking(ranked)
        const relevant = new Set(q.relevantFiles)
        return {
          ndcg: ndcgAtK(ranking, relevant, K),
          recall: recallAtK(ranking, relevant, K),
          mrr: reciprocalRank(ranking, relevant),
        }
      })
      row[label] = {
        ndcg10: mean(scores.map((s) => s.ndcg)),
        recall10: mean(scores.map((s) => s.recall)),
        mrr: mean(scores.map((s) => s.mrr)),
        n: qs.length,
      }
      return row[label].ndcg10.toFixed(3).padEnd(16)
    })

    rows.push({ testWeight: { value: testWeight }, ...row })
    console.log(String(testWeight).padEnd(10) + cells.join(''))
  }

  console.log('n='.padEnd(10) + groups.map(([, qs]) => String(qs.length).padEnd(16)).join(''))

  fs.writeFileSync(
    path.join(process.cwd(), 'eval', 'results', `prior-sweep${UNIFORM ? '.uniform' : ''}.json`),
    JSON.stringify({ generatedAt: new Date().toISOString(), k: K, pool: POOL, rows }, null, 2)
  )
  console.log('\n→ eval/results/prior-sweep.json')
  await pool.end()
}

main()
