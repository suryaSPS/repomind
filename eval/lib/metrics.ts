/**
 * Retrieval metrics.
 *
 * Everything here scores a *ranked list of file paths* against a set of
 * relevant file paths. File-level is the right granularity for RepoMind:
 * chunk boundaries are an artefact of the 60-line splitter, and what the agent
 * ultimately cites — and what a developer opens — is a file.
 */

/** The only thing the metrics need from a retriever's output is the order of files. */
export interface RankedResult {
  filePath: string
}

/** Collapse a chunk ranking to a file ranking, keeping each file's best rank. */
export function toFileRanking(results: RankedResult[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const r of results) {
    if (seen.has(r.filePath)) continue
    seen.add(r.filePath)
    ordered.push(r.filePath)
  }
  return ordered
}

/** Fraction of the relevant files that appear in the top k. */
export function recallAtK(ranking: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0
  const top = ranking.slice(0, k)
  const found = top.filter((f) => relevant.has(f)).length
  return found / relevant.size
}

/** Fraction of the top k that are relevant. */
export function precisionAtK(ranking: string[], relevant: Set<string>, k: number): number {
  if (k === 0) return 0
  const top = ranking.slice(0, k)
  return top.filter((f) => relevant.has(f)).length / Math.min(k, Math.max(top.length, 1))
}

/** 1 if any relevant file made the top k, else 0. Answers "could the agent possibly be right?" */
export function hitAtK(ranking: string[], relevant: Set<string>, k: number): number {
  return ranking.slice(0, k).some((f) => relevant.has(f)) ? 1 : 0
}

/** Reciprocal rank of the first relevant file (0 if none retrieved). */
export function reciprocalRank(ranking: string[], relevant: Set<string>): number {
  for (let i = 0; i < ranking.length; i++) {
    if (relevant.has(ranking[i])) return 1 / (i + 1)
  }
  return 0
}

/**
 * nDCG@k with binary relevance. Rewards putting relevant files near the top,
 * which matters here because the prompt only carries the first few chunks.
 */
export function ndcgAtK(ranking: string[], relevant: Set<string>, k: number): number {
  let dcg = 0
  for (let i = 0; i < Math.min(k, ranking.length); i++) {
    if (relevant.has(ranking[i])) dcg += 1 / Math.log2(i + 2)
  }

  let idcg = 0
  for (let i = 0; i < Math.min(k, relevant.size); i++) {
    idcg += 1 / Math.log2(i + 2)
  }

  return idcg === 0 ? 0 : dcg / idcg
}

/** Mean average precision over the top k. */
export function averagePrecisionAtK(ranking: string[], relevant: Set<string>, k: number): number {
  if (relevant.size === 0) return 0
  let hits = 0
  let sum = 0
  for (let i = 0; i < Math.min(k, ranking.length); i++) {
    if (relevant.has(ranking[i])) {
      hits++
      sum += hits / (i + 1)
    }
  }
  return sum / Math.min(relevant.size, k)
}

// ── Aggregation ───────────────────────────────────────────────────────────────

export const K_VALUES = [1, 3, 5, 10, 20] as const

export interface QueryScores {
  recall: Record<number, number>
  precision: Record<number, number>
  hit: Record<number, number>
  ndcg: Record<number, number>
  ap: Record<number, number>
  mrr: number
  latencyMs: number
}

export function scoreQuery(
  ranking: string[],
  relevant: Set<string>,
  latencyMs: number
): QueryScores {
  const scores: QueryScores = {
    recall: {},
    precision: {},
    hit: {},
    ndcg: {},
    ap: {},
    mrr: reciprocalRank(ranking, relevant),
    latencyMs,
  }
  for (const k of K_VALUES) {
    scores.recall[k] = recallAtK(ranking, relevant, k)
    scores.precision[k] = precisionAtK(ranking, relevant, k)
    scores.hit[k] = hitAtK(ranking, relevant, k)
    scores.ndcg[k] = ndcgAtK(ranking, relevant, k)
    scores.ap[k] = averagePrecisionAtK(ranking, relevant, k)
  }
  return scores
}

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

/**
 * Paired bootstrap test. Two retrievers see the same queries, so pairing them
 * removes query difficulty from the comparison and needs far fewer queries to
 * detect a real difference than an unpaired test would.
 *
 * Returns the probability that the observed improvement of `b` over `a` is an
 * artefact of which queries happened to be in the dataset.
 */
export function pairedBootstrapPValue(a: number[], b: number[], iterations = 10_000): number {
  if (a.length !== b.length || a.length === 0) return 1
  const n = a.length
  const observed = mean(b) - mean(a)
  if (observed === 0) return 1

  // Centre the per-query differences so the resampling distribution is the
  // null ("no difference"), then ask how often noise alone clears `observed`.
  const diffs = a.map((ai, i) => b[i] - ai)
  const centred = diffs.map((d) => d - observed)

  let atLeastAsExtreme = 0
  for (let it = 0; it < iterations; it++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += centred[Math.floor(Math.random() * n)]
    }
    if (Math.abs(sum / n) >= Math.abs(observed)) atLeastAsExtreme++
  }
  return atLeastAsExtreme / iterations
}

/** 95% bootstrap confidence interval for a mean. */
export function bootstrapCI(xs: number[], iterations = 5_000): [number, number] {
  if (xs.length === 0) return [0, 0]
  const means: number[] = []
  for (let it = 0; it < iterations; it++) {
    let sum = 0
    for (let i = 0; i < xs.length; i++) sum += xs[Math.floor(Math.random() * xs.length)]
    means.push(sum / xs.length)
  }
  means.sort((a, b) => a - b)
  return [means[Math.floor(0.025 * iterations)], means[Math.floor(0.975 * iterations)]]
}
