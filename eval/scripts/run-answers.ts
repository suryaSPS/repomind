/**
 * End-to-end answer evaluation.
 *
 * Retrieval metrics say whether the right file was *available*. They say
 * nothing about whether the agent used it, cited it correctly, or invented a
 * path. This runs the real agent — same prompt assembly, same tools, same model
 * as POST /api/chat, via lib/agent/runtime — once per arm, and records
 * everything needed to grade the answers afterwards.
 *
 * Arms:
 *   dense   — production pre-retrieval (dense vector search)
 *   hybrid  — dense + lexical fused by reciprocal rank
 *
 * Run: npx tsx eval/scripts/run-answers.ts [--arm dense|hybrid] [--limit N]
 */
import '../lib/env'
import fs from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { pool } from '@/lib/db'
import { embedBatch } from '@/lib/ingestion/embedder'
import { searchCodeChunksHybrid } from '@/lib/vector/hybrid'
import { applySourcePrior } from '@/lib/vector/source-prior'
import { searchCodeChunks, searchCommitChunks } from '@/lib/vector/search'
import {
  buildAgentTurn, densePrefetcher, AGENT_MODEL, AGENT_MAX_STEPS,
  PREFETCH_CODE, PREFETCH_COMMITS, type Prefetcher, type RepoRef,
} from '@/lib/agent/runtime'
import { loadDataset } from '../lib/dataset'
import { CORPUS } from '../corpus'

/** The candidate arm: identical to production except for how context is chosen. */
const hybridPrefetcher: Prefetcher = async (repoIds, question) => {
  const [queryEmbedding] = await embedBatch([question])
  const [code, commits] = await Promise.all([
    searchCodeChunksHybrid(repoIds, queryEmbedding, question, PREFETCH_CODE),
    searchCommitChunks(repoIds[0], queryEmbedding, PREFETCH_COMMITS),
  ])
  return { code, commits }
}

/**
 * The candidate that won on retrieval metrics: retrieve wider, re-order by
 * source kind, cut to the same 5 chunks the prompt has always carried. The
 * prompt is byte-identical in shape between arms — only which chunks fill it
 * changes — so any difference in answers is attributable to retrieval.
 */
const PRIOR_POOL = 40

const priorPrefetcher: Prefetcher = async (repoIds, question) => {
  const [queryEmbedding] = await embedBatch([question])
  const [candidates, commits] = await Promise.all([
    searchCodeChunks(repoIds[0], queryEmbedding, PRIOR_POOL),
    searchCommitChunks(repoIds[0], queryEmbedding, PREFETCH_COMMITS),
  ])
  return { code: applySourcePrior(candidates, question, PREFETCH_CODE), commits }
}

const ARMS: Record<string, Prefetcher> = {
  dense: densePrefetcher,
  hybrid: hybridPrefetcher,
  prior: priorPrefetcher,
}

const argValue = (flag: string) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined

const CONCURRENCY = 4

export interface AnswerRun {
  queryId: string
  repo: string
  type: string
  question: string
  relevantFiles: string[]
  arm: string
  answer: string
  prefetchedFiles: string[]
  toolCalls: { name: string; args: unknown }[]
  steps: number
  promptTokens: number
  completionTokens: number
  latencyMs: number
  error?: string
}

async function repoRefs(): Promise<Map<string, RepoRef>> {
  const map = new Map<string, RepoRef>()
  for (const entry of CORPUS) {
    const { rows } = await pool.query(
      `SELECT id, name, url FROM repos WHERE url = $1 AND status = 'ready' ORDER BY id DESC LIMIT 1`,
      [entry.url]
    )
    if (rows.length > 0) map.set(entry.key, rows[0])
  }
  return map
}

async function runOne(
  query: ReturnType<typeof loadDataset>[number],
  repo: RepoRef,
  arm: string
): Promise<AnswerRun> {
  const base = {
    queryId: query.id,
    repo: query.repo,
    type: query.type,
    question: query.question,
    relevantFiles: query.relevantFiles,
    arm,
  }

  const started = performance.now()
  try {
    const turn = await buildAgentTurn([repo], query.question, ARMS[arm])

    const result = await generateText({
      model: anthropic(AGENT_MODEL),
      system: turn.system,
      messages: [{ role: 'user', content: query.question }],
      tools: turn.tools,
      maxSteps: AGENT_MAX_STEPS,
    })

    const toolCalls = result.steps.flatMap((s) =>
      s.toolCalls.map((c) => ({ name: c.toolName, args: c.args }))
    )

    return {
      ...base,
      answer: result.text,
      prefetchedFiles: turn.prefetchedFiles,
      toolCalls,
      steps: result.steps.length,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      latencyMs: performance.now() - started,
    }
  } catch (err) {
    return {
      ...base,
      answer: '',
      prefetchedFiles: [],
      toolCalls: [],
      steps: 0,
      promptTokens: 0,
      completionTokens: 0,
      latencyMs: performance.now() - started,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Bounded-concurrency map — the API and Neon both dislike 66 simultaneous callers. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i])
      process.stdout.write('.')
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  // Default to the A/B that matters: shipped behaviour vs the retrieval winner.
  const armNames = argValue('--arm') ? [argValue('--arm')!] : ['dense', 'prior']
  const limit = argValue('--limit') ? Number(argValue('--limit')) : undefined

  const refs = await repoRefs()
  let queries = loadDataset('gold').filter((q) => refs.has(q.repo))
  if (limit) queries = queries.slice(0, limit)

  const outDir = path.join(process.cwd(), 'eval', 'results')
  fs.mkdirSync(outDir, { recursive: true })

  for (const arm of armNames) {
    if (!ARMS[arm]) throw new Error(`Unknown arm: ${arm}`)
    console.log(`\n▶ arm "${arm}" — ${queries.length} questions, model ${AGENT_MODEL}`)

    const started = Date.now()
    const runs = await mapLimit(queries, CONCURRENCY, (q) =>
      runOne(q, refs.get(q.repo)!, arm)
    )

    const failed = runs.filter((r) => r.error)
    const outFile = path.join(outDir, `answers.${arm}.json`)
    fs.writeFileSync(outFile, JSON.stringify(runs, null, 2))

    console.log(
      `\n  ${runs.length - failed.length}/${runs.length} answered in ` +
      `${((Date.now() - started) / 1000).toFixed(0)}s → ${path.relative(process.cwd(), outFile)}`
    )
    if (failed.length > 0) {
      console.log(`  ⚠ ${failed.length} failed: ${failed.slice(0, 3).map((f) => f.error).join(' | ')}`)
    }
  }

  await pool.end()
}

main()
