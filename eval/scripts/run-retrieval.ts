/**
 * Retrieval evaluation.
 *
 * Every retriever sees the same queries, in the same order, against the same
 * index, and query embeddings are computed once and shared — so the only thing
 * varying between rows of the results table is the ranking strategy itself.
 *
 * Run: npx tsx eval/scripts/run-retrieval.ts [--tier gold|silver] [--k 20]
 */
import '../lib/env'
import fs from 'fs'
import path from 'path'
import { pool } from '@/lib/db'
import { embedBatch } from '@/lib/ingestion/embedder'
import { loadDataset, groupByRepo, type EvalQuery } from '../lib/dataset'
import { CORPUS } from '../corpus'
import { BASE_RETRIEVERS, type Retriever } from '../lib/retrievers'
import {
  scoreQuery, toFileRanking, mean, percentile, bootstrapCI,
  pairedBootstrapPValue, K_VALUES, type QueryScores,
} from '../lib/metrics'

const argTier = process.argv.includes('--tier')
  ? (process.argv[process.argv.indexOf('--tier') + 1] as 'gold' | 'silver')
  : undefined
const RETRIEVE_K = process.argv.includes('--k')
  ? Number(process.argv[process.argv.indexOf('--k') + 1])
  : 20

/** `--only dense,bm25` restricts the run — useful while iterating. */
const ONLY = process.argv.includes('--only')
  ? new Set(process.argv[process.argv.indexOf('--only') + 1].split(','))
  : null

const RETRIEVERS: Retriever[] = ONLY
  ? BASE_RETRIEVERS.filter((r) => ONLY.has(r.name))
  : BASE_RETRIEVERS

const BASELINE = 'dense'

interface PerQueryRecord {
  queryId: string
  repo: string
  type: string
  tier: string
  sourceKind?: string
  scores: QueryScores
  ranking: string[]
  relevant: string[]
}

async function resolveRepoIds(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (const entry of CORPUS) {
    const { rows } = await pool.query(
      `SELECT id FROM repos WHERE url = $1 AND status = 'ready' ORDER BY id DESC LIMIT 1`,
      [entry.url]
    )
    if (rows.length > 0) map.set(entry.key, rows[0].id)
  }
  return map
}

/** One embedding per distinct question, reused by every retriever. */
async function embedQuestions(queries: EvalQuery[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>()
  const BATCH = 100
  for (let i = 0; i < queries.length; i += BATCH) {
    const batch = queries.slice(i, i + BATCH)
    const vectors = await embedBatch(batch.map((q) => q.question))
    batch.forEach((q, j) => map.set(q.id, vectors[j]))
  }
  return map
}

function summarise(records: PerQueryRecord[]) {
  const at = (pick: (s: QueryScores) => number) => mean(records.map((r) => pick(r.scores)))
  const summary: Record<string, number | number[]> = {
    queries: records.length,
    mrr: at((s) => s.mrr),
    latencyP50: percentile(records.map((r) => r.scores.latencyMs), 50),
    latencyP95: percentile(records.map((r) => r.scores.latencyMs), 95),
    latencyMean: mean(records.map((r) => r.scores.latencyMs)),
  }
  for (const k of K_VALUES) {
    summary[`recall@${k}`] = at((s) => s.recall[k])
    summary[`precision@${k}`] = at((s) => s.precision[k])
    summary[`hit@${k}`] = at((s) => s.hit[k])
    summary[`ndcg@${k}`] = at((s) => s.ndcg[k])
    summary[`map@${k}`] = at((s) => s.ap[k])
  }
  return summary
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = out.get(k) ?? []
    list.push(item)
    out.set(k, list)
  }
  return out
}

async function main() {
  const queries = loadDataset(argTier)
  if (queries.length === 0) throw new Error('No queries loaded — is eval/datasets populated?')

  const repoIds = await resolveRepoIds()
  const usable = queries.filter((q) => repoIds.has(q.repo))
  const skipped = queries.length - usable.length
  if (skipped > 0) console.warn(`⚠  ${skipped} queries skipped — their repo is not indexed.`)

  console.log(`Embedding ${usable.length} questions…`)
  const embeddings = await embedQuestions(usable)

  const byRepo = groupByRepo(usable)
  const results: Record<string, PerQueryRecord[]> = {}

  for (const retriever of RETRIEVERS) {
    const records: PerQueryRecord[] = []
    process.stdout.write(`\n▶ ${retriever.label}`)

    for (const [repoKey, repoQueries] of byRepo) {
      const repoId = repoIds.get(repoKey)!
      if (retriever.prepare) await retriever.prepare(repoId)

      for (const q of repoQueries) {
        const ctx = {
          repoId,
          query: q.question,
          queryEmbedding: embeddings.get(q.id)!,
          k: RETRIEVE_K,
        }

        const started = performance.now()
        const hits = await retriever.retrieve(ctx)
        const latencyMs = performance.now() - started

        const ranking = toFileRanking(hits)
        const relevant = new Set(q.relevantFiles)

        records.push({
          queryId: q.id,
          repo: q.repo,
          type: q.type,
          tier: q.tier,
          sourceKind: q.sourceKind,
          scores: scoreQuery(ranking, relevant, latencyMs),
          ranking: ranking.slice(0, 10),
          relevant: q.relevantFiles,
        })
      }
      process.stdout.write('.')
    }

    results[retriever.name] = records
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    retrieveK: RETRIEVE_K,
    tier: argTier ?? 'all',
    corpus: Object.fromEntries(
      await Promise.all(
        [...repoIds].map(async ([key, id]) => {
          const { rows } = await pool.query(
            `SELECT count(*)::int AS chunks, count(DISTINCT file_path)::int AS files
             FROM code_chunks WHERE repo_id = $1`, [id]
          )
          return [key, { repoId: id, ...rows[0] }]
        })
      )
    ),
    retrievers: {} as Record<string, unknown>,
    perQuery: results,
  }

  const baselineRecords = results[BASELINE]

  for (const retriever of RETRIEVERS) {
    const records = results[retriever.name]
    const ndcg10 = records.map((r) => r.scores.ndcg[10])
    const recall10 = records.map((r) => r.scores.recall[10])

    report.retrievers[retriever.name] = {
      label: retriever.label,
      description: retriever.description,
      overall: summarise(records),
      ndcg10CI: bootstrapCI(ndcg10),
      recall10CI: bootstrapCI(recall10),
      vsBaseline: retriever.name === BASELINE ? null : {
        baseline: BASELINE,
        ndcg10Delta: mean(ndcg10) - mean(baselineRecords.map((r) => r.scores.ndcg[10])),
        ndcg10P: pairedBootstrapPValue(baselineRecords.map((r) => r.scores.ndcg[10]), ndcg10),
        recall10Delta: mean(recall10) - mean(baselineRecords.map((r) => r.scores.recall[10])),
        recall10P: pairedBootstrapPValue(baselineRecords.map((r) => r.scores.recall[10]), recall10),
      },
      byRepo: Object.fromEntries(
        [...groupBy(records, (r) => r.repo)].map(([k, v]) => [k, summarise(v)])
      ),
      byType: Object.fromEntries(
        [...groupBy(records, (r) => r.type)].map(([k, v]) => [k, summarise(v)])
      ),
      byTier: Object.fromEntries(
        [...groupBy(records, (r) => r.tier)].map(([k, v]) => [k, summarise(v)])
      ),
      bySourceKind: Object.fromEntries(
        [...groupBy(records.filter((r) => r.sourceKind), (r) => r.sourceKind!)]
          .map(([k, v]) => [k, summarise(v)])
      ),
    }
  }

  const outDir = path.join(process.cwd(), 'eval', 'results')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `retrieval${argTier ? `.${argTier}` : ''}.json`)
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))

  // ── Console table ───────────────────────────────────────────────────────────
  console.log('\n')
  const header = ['retriever', 'R@1', 'R@5', 'R@10', 'MRR', 'nDCG@10', 'P@5', 'p50 ms', 'p95 ms']
  const widths = [30, 6, 6, 6, 6, 8, 6, 8, 8]
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('')
  console.log(line(header))
  console.log('─'.repeat(widths.reduce((a, b) => a + b, 0)))

  for (const retriever of RETRIEVERS) {
    const s = (report.retrievers[retriever.name] as { overall: Record<string, number> }).overall
    console.log(line([
      retriever.label,
      s['recall@1'].toFixed(3),
      s['recall@5'].toFixed(3),
      s['recall@10'].toFixed(3),
      s.mrr.toFixed(3),
      s['ndcg@10'].toFixed(3),
      s['precision@5'].toFixed(3),
      s.latencyP50.toFixed(1),
      s.latencyP95.toFixed(1),
    ]))
  }

  console.log(`\n→ ${path.relative(process.cwd(), outFile)}`)
  await pool.end()
}

main()
