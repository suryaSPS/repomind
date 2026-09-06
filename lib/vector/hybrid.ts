import { pool } from '@/lib/db'
import { toTsQuery } from './tokenize'
import type { CodeResult } from './search'

/**
 * Hybrid retrieval: dense vectors fused with code-aware lexical search.
 *
 * Dense embeddings are good at "how does the framework decide which session
 * backend to use" and bad at "where is getGitHubToken" — an exact identifier
 * carries almost no semantic signal, so the nearest-neighbour list fills up
 * with code that merely looks similar. Lexical search has the opposite
 * strengths. Fusing the two rankings covers both.
 *
 * Requires the `content_tsv` generated column (see the migration that adds it).
 * `lexicalSearchAvailable()` reports whether it exists, so callers can fall
 * back to dense-only rather than erroring on an index that has not been built.
 */

/** Rank constant for reciprocal rank fusion. 60 is the value from the original paper. */
const RRF_K = 60

/** Candidates each arm contributes before fusion. */
const CANDIDATE_POOL = 30

/**
 * Fusion weights for [dense, lexical].
 *
 * Equal weighting measurably hurt: on the gold set it cost 0.067 nDCG@10
 * against dense alone (paired bootstrap p=0.008), because giving a weaker arm
 * an equal vote lets it displace correct dense hits at rank 1. Dense is the
 * stronger arm on prose questions, so it gets the larger vote; lexical still
 * contributes enough to rescue exact-identifier lookups, which dense misses.
 */
const FUSION_WEIGHTS = [3, 1]

let lexicalAvailable: boolean | null = null

export async function lexicalSearchAvailable(): Promise<boolean> {
  if (lexicalAvailable !== null) return lexicalAvailable
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = 'code_chunks' AND column_name = 'content_tsv'`
  )
  lexicalAvailable = rows.length > 0
  return lexicalAvailable
}

/** Lexical arm: coverage-density ranking over the code-aware tsvector. */
export async function lexicalSearchCodeChunks(
  repoIds: number[],
  question: string,
  limit = CANDIDATE_POOL
): Promise<CodeResult[]> {
  if (repoIds.length === 0) return []
  const tsq = toTsQuery(question)
  if (!tsq) return []

  const placeholders = repoIds.map((_, i) => `$${i + 2}`).join(', ')
  const { rows } = await pool.query(
    `SELECT id, repo_id AS "repoId", file_path AS "filePath",
            line_start AS "lineStart", line_end AS "lineEnd",
            content, language,
            ts_rank_cd(content_tsv, q, 1) AS similarity
     FROM code_chunks, to_tsquery('simple', $1) q
     WHERE repo_id IN (${placeholders}) AND content_tsv @@ q
     ORDER BY similarity DESC
     LIMIT $${repoIds.length + 2}`,
    [tsq, ...repoIds, limit]
  )
  return rows
}

/**
 * Fuse ranked lists by reciprocal rank.
 *
 * Rank fusion rather than a weighted score blend: cosine similarity and
 * ts_rank_cd are on incomparable scales, so blending them would need a
 * calibration constant tuned per corpus. Ranks need none.
 */
export function fuseByReciprocalRank(
  rankings: CodeResult[][],
  limit: number,
  weights?: number[]
): CodeResult[] {
  const fused = new Map<number, { score: number; result: CodeResult }>()

  rankings.forEach((ranking, listIndex) => {
    const weight = weights?.[listIndex] ?? 1
    ranking.forEach((result, rank) => {
      const contribution = weight / (RRF_K + rank + 1)
      const existing = fused.get(result.id)
      if (existing) existing.score += contribution
      else fused.set(result.id, { score: contribution, result })
    })
  })

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    // Keep `similarity` meaningful downstream: it is now a fusion score, not a
    // cosine, so callers must not print it as a percentage match.
    .map((e) => ({ ...e.result, similarity: e.score }))
}

/**
 * Dense + lexical, fused. Falls back to the dense list alone when the lexical
 * index has not been created.
 */
export async function searchCodeChunksHybrid(
  repoIds: number[],
  queryEmbedding: number[],
  question: string,
  limit = 5
): Promise<CodeResult[]> {
  if (repoIds.length === 0) return []

  const vectorStr = `[${queryEmbedding.join(',')}]`
  const placeholders = repoIds.map((_, i) => `$${i + 2}`).join(', ')

  const densePromise = pool.query(
    `SELECT id, repo_id AS "repoId", file_path AS "filePath",
            line_start AS "lineStart", line_end AS "lineEnd",
            content, language,
            1 - (embedding <=> $1::vector) AS similarity
     FROM code_chunks
     WHERE repo_id IN (${placeholders})
     ORDER BY embedding <=> $1::vector
     LIMIT $${repoIds.length + 2}`,
    [vectorStr, ...repoIds, CANDIDATE_POOL]
  )

  if (!(await lexicalSearchAvailable())) {
    const { rows } = await densePromise
    return rows.slice(0, limit)
  }

  const [dense, lexical] = await Promise.all([
    densePromise.then((r) => r.rows as CodeResult[]),
    lexicalSearchCodeChunks(repoIds, question, CANDIDATE_POOL),
  ])

  return fuseByReciprocalRank([dense, lexical], limit, FUSION_WEIGHTS)
}
