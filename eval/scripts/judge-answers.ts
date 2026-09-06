/**
 * Grades the recorded answers and writes the end-to-end results table.
 *
 * Split from run-answers.ts so grading can be re-run — with a different judge,
 * or after a rubric change — without paying to regenerate the answers.
 *
 * Run: npx tsx eval/scripts/judge-answers.ts [--arms dense,prior]
 */
import '../lib/env'
import fs from 'fs'
import path from 'path'
import { pool } from '@/lib/db'
import { CORPUS } from '../corpus'
import { extractCitations, scoreCitations, type CitationScores } from '../lib/citations'
import { judgeAnswer, JUDGE_MODEL } from '../lib/judge'
import { mean, percentile, pairedBootstrapPValue, bootstrapCI } from '../lib/metrics'
import type { AnswerRun } from './run-answers'

/** Anthropic list price for the agent model, $ per million tokens. */
const AGENT_PRICE = { input: 1.0, output: 5.0 }

const GROUND_TRUTH_CHARS = 4000
const CONCURRENCY = 6

/** Skip the model entirely and report only the deterministic metrics. */
const NO_JUDGE = process.argv.includes('--no-judge')

const argValue = (flag: string) =>
  process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : undefined

interface Judged extends AnswerRun {
  citations: CitationScores
  correctness: number | null
  citationQuality: number | null
  rationale: string
  judgeInputTokens: number
  judgeOutputTokens: number
}

async function indexedFilesByRepo(): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  for (const entry of CORPUS) {
    const { rows } = await pool.query(
      `SELECT DISTINCT rf.file_path FROM repo_files rf
       JOIN repos r ON r.id = rf.repo_id
       WHERE r.url = $1 AND r.status = 'ready'`,
      [entry.url]
    )
    out.set(entry.key, new Set(rows.map((r: { file_path: string }) => r.file_path)))
  }
  return out
}

async function groundTruth(repoKey: string, files: string[]) {
  const entry = CORPUS.find((c) => c.key === repoKey)!
  const { rows } = await pool.query(
    `SELECT rf.file_path AS "filePath", rf.content FROM repo_files rf
     JOIN repos r ON r.id = rf.repo_id
     WHERE r.url = $1 AND rf.file_path = ANY($2::text[])`,
    [entry.url, files.slice(0, 2)]
  )
  return rows.map((r: { filePath: string; content: string }) => ({
    filePath: r.filePath,
    content: r.content.slice(0, GROUND_TRUTH_CHARS),
  }))
}

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

function summarise(rows: Judged[]) {
  const graded = rows.filter((r) => r.correctness !== null)
  const cost = (r: Judged) =>
    (r.promptTokens * AGENT_PRICE.input + r.completionTokens * AGENT_PRICE.output) / 1_000_000

  return {
    answers: rows.length,
    graded: graded.length,
    correctness: mean(graded.map((r) => r.correctness!)),
    correctnessCI: bootstrapCI(graded.map((r) => r.correctness!)),
    citationQuality: mean(graded.map((r) => r.citationQuality!)),
    /** Share of answers scoring 4 or 5 — "would a developer trust this". */
    correctnessPass: mean(graded.map((r) => (r.correctness! >= 4 ? 1 : 0))),
    citedGoldFile: mean(rows.map((r) => (r.citations.hitGold ? 1 : 0))),
    citationValidRate: mean(rows.map((r) => r.citations.validRate)),
    hallucinatedPathRate: mean(rows.map((r) => (r.citations.hallucinated > 0 ? 1 : 0))),
    hallucinatedPathsTotal: rows.reduce((a, r) => a + r.citations.hallucinated, 0),
    citationsPerAnswer: mean(rows.map((r) => r.citations.cited)),
    toolCalls: mean(rows.map((r) => r.toolCalls.length)),
    steps: mean(rows.map((r) => r.steps)),
    promptTokens: mean(rows.map((r) => r.promptTokens)),
    completionTokens: mean(rows.map((r) => r.completionTokens)),
    costPerAnswerUsd: mean(rows.map(cost)),
    latencyP50: percentile(rows.map((r) => r.latencyMs), 50),
    latencyP95: percentile(rows.map((r) => r.latencyMs), 95),
    errors: rows.filter((r) => r.error).length,
  }
}

async function main() {
  const arms = (argValue('--arms') ?? 'dense,prior').split(',')
  const indexed = await indexedFilesByRepo()
  const outDir = path.join(process.cwd(), 'eval', 'results')
  const judgedByArm: Record<string, Judged[]> = {}

  for (const arm of arms) {
    const file = path.join(outDir, `answers.${arm}.json`)
    if (!fs.existsSync(file)) throw new Error(`Missing ${file} — run run-answers.ts first`)

    // Runs that errored produced no answer; including them would report a
    // perfect citation rate for having cited nothing.
    const runs: AnswerRun[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
      .filter((r: AnswerRun) => !r.error && r.answer.trim().length > 0)
    console.log(
      NO_JUDGE
        ? `\n▶ arm "${arm}" — ${runs.length} answers, deterministic metrics only`
        : `\n▶ judging arm "${arm}" — ${runs.length} answers with ${JUDGE_MODEL}`
    )

    const judged = await mapLimit(runs, CONCURRENCY, async (run): Promise<Judged> => {
      const citations = scoreCitations(
        extractCitations(run.answer),
        indexed.get(run.repo) ?? new Set(),
        run.relevantFiles
      )

      const verdict = run.answer.trim() && !NO_JUDGE
        ? await judgeAnswer({
            question: run.question,
            answer: run.answer,
            groundTruth: await groundTruth(run.repo, run.relevantFiles),
          })
        : null

      return {
        ...run,
        citations,
        correctness: verdict?.correctness ?? null,
        citationQuality: verdict?.citationQuality ?? null,
        rationale: verdict?.rationale ?? '',
        judgeInputTokens: verdict?.inputTokens ?? 0,
        judgeOutputTokens: verdict?.outputTokens ?? 0,
      }
    })

    judgedByArm[arm] = judged
    fs.writeFileSync(path.join(outDir, `judged.${arm}.json`), JSON.stringify(judged, null, 2))
  }

  // ── Summary + significance ──────────────────────────────────────────────────
  const report = {
    generatedAt: new Date().toISOString(),
    judgeModel: JUDGE_MODEL,
    arms: Object.fromEntries(
      Object.entries(judgedByArm).map(([arm, rows]) => [arm, summarise(rows)])
    ),
    comparison: {} as Record<string, unknown>,
  }

  if (arms.length === 2) {
    const [a, b] = arms
    // Pair by query id: the same question in both arms, so query difficulty
    // cancels out of the comparison.
    const byId = new Map(judgedByArm[a].map((r) => [r.queryId, r]))
    const pairs = judgedByArm[b]
      .map((rb) => ({ a: byId.get(rb.queryId), b: rb }))
      .filter((p): p is { a: Judged; b: Judged } => Boolean(p.a))

    const paired = (pick: (r: Judged) => number | null) => {
      const usable = pairs.filter((p) => pick(p.a) !== null && pick(p.b) !== null)
      return {
        n: usable.length,
        a: usable.map((p) => pick(p.a)!),
        b: usable.map((p) => pick(p.b)!),
      }
    }

    const correctness = paired((r) => r.correctness)
    const citedGold = paired((r) => (r.citations.hitGold ? 1 : 0))

    report.comparison = {
      baseline: a,
      candidate: b,
      correctness: {
        n: correctness.n,
        delta: mean(correctness.b) - mean(correctness.a),
        p: pairedBootstrapPValue(correctness.a, correctness.b),
      },
      citedGoldFile: {
        n: citedGold.n,
        delta: mean(citedGold.b) - mean(citedGold.a),
        p: pairedBootstrapPValue(citedGold.a, citedGold.b),
      },
    }
  }

  fs.writeFileSync(path.join(outDir, 'answers.summary.json'), JSON.stringify(report, null, 2))

  console.log('\n')
  const metrics: [string, (s: ReturnType<typeof summarise>) => string][] = [
    ['correctness (1-5)', (s) => s.correctness.toFixed(2)],
    ['correctness >= 4', (s) => `${(s.correctnessPass * 100).toFixed(1)}%`],
    ['citation quality (1-5)', (s) => s.citationQuality.toFixed(2)],
    ['cited a labelled file', (s) => `${(s.citedGoldFile * 100).toFixed(1)}%`],
    ['citation valid rate', (s) => `${(s.citationValidRate * 100).toFixed(1)}%`],
    ['answers w/ bad path', (s) => `${(s.hallucinatedPathRate * 100).toFixed(1)}%`],
    ['citations per answer', (s) => s.citationsPerAnswer.toFixed(1)],
    ['tool calls', (s) => s.toolCalls.toFixed(1)],
    ['prompt tokens', (s) => s.promptTokens.toFixed(0)],
    ['cost / answer', (s) => `$${s.costPerAnswerUsd.toFixed(4)}`],
    ['latency p50', (s) => `${(s.latencyP50 / 1000).toFixed(1)}s`],
  ]

  console.log('metric'.padEnd(26) + arms.map((a) => a.padEnd(14)).join(''))
  console.log('─'.repeat(26 + arms.length * 14))
  for (const [label, pick] of metrics) {
    console.log(
      label.padEnd(26) +
        arms.map((a) => pick(report.arms[a] as ReturnType<typeof summarise>).padEnd(14)).join('')
    )
  }

  if (arms.length === 2) {
    const c = report.comparison as { correctness: { delta: number; p: number }; citedGoldFile: { delta: number; p: number } }
    console.log(`\ncorrectness Δ ${c.correctness.delta >= 0 ? '+' : ''}${c.correctness.delta.toFixed(3)} (p=${c.correctness.p.toFixed(4)})`)
    console.log(`cited-gold Δ  ${c.citedGoldFile.delta >= 0 ? '+' : ''}${(c.citedGoldFile.delta * 100).toFixed(1)}pp (p=${c.citedGoldFile.p.toFixed(4)})`)
  }

  await pool.end()
}

main()
