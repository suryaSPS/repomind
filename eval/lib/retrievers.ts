/**
 * The retrieval strategies under test.
 *
 * `dense` is exactly what production does today — same SQL, same embedding
 * model — so every other row of the results table is a like-for-like comparison
 * against the shipped system rather than against a strawman. `lexical` and
 * `hybrid` call `lib/vector/hybrid.ts` directly, so a win here is a win in code
 * that can ship, not in an eval-only reimplementation.
 */
import { pool } from '@/lib/db'
import { tokenize } from '@/lib/vector/tokenize'
import {
  lexicalSearchCodeChunks,
  fuseByReciprocalRank,
  searchCodeChunksHybrid,
} from '@/lib/vector/hybrid'
import { applySourcePrior } from '@/lib/vector/source-prior'
import type { CodeResult } from '@/lib/vector/search'
import type { RankedResult } from './metrics'

export interface RetrievalContext {
  repoId: number
  query: string
  queryEmbedding: number[]
  k: number
}

export interface Retriever {
  name: string
  label: string
  description: string
  /** Optional one-off setup per repo (e.g. building an in-memory index). */
  prepare?(repoId: number): Promise<void>
  retrieve(ctx: RetrievalContext): Promise<RankedResult[]>
}

const CANDIDATE_POOL = 30

// ── 1. Dense: the production path ─────────────────────────────────────────────

async function denseRows(
  repoId: number,
  queryEmbedding: number[],
  limit: number
): Promise<CodeResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const { rows } = await pool.query(
    `SELECT id, repo_id AS "repoId", file_path AS "filePath",
            line_start AS "lineStart", line_end AS "lineEnd",
            content, language,
            1 - (embedding <=> $1::vector) AS similarity
     FROM code_chunks
     WHERE repo_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, repoId, limit]
  )
  return rows
}

export const denseRetriever: Retriever = {
  name: 'dense',
  label: 'Dense (production)',
  description:
    'Cosine similarity over text-embedding-3-small vectors — the query shipped in lib/vector/search.ts.',
  async retrieve({ repoId, queryEmbedding, k }) {
    return denseRows(repoId, queryEmbedding, k)
  },
}

// ── 2. Lexical: Postgres full-text over the code-aware tsvector ───────────────

export const lexicalRetriever: Retriever = {
  name: 'lexical',
  label: 'Lexical (Postgres FTS)',
  description:
    'ts_rank_cd over a generated tsvector indexing raw content, camel/snake-split content, and the file path.',
  async retrieve({ repoId, query, k }) {
    return lexicalSearchCodeChunks([repoId], query, k)
  },
}

// ── 3. BM25: in-process reference implementation ──────────────────────────────
//
// Postgres `ts_rank_cd` is a coverage-density score, not BM25 — no term
// saturation, and length normalisation of a different shape. Running a real
// BM25 alongside it answers whether the FTS approximation is costing recall,
// without which the lexical row is hard to interpret.
//
// Note on latency: this runs in the Node process against an in-memory index,
// so its timings exclude the network round trip every Postgres-backed retriever
// pays. Compare its *quality* to the others, not its milliseconds.

interface Bm25Doc {
  row: CodeResult
  tf: Map<string, number>
  len: number
}

interface Bm25Index {
  docs: Bm25Doc[]
  df: Map<string, number>
  avgLen: number
}

const BM25_K1 = 1.2
const BM25_B = 0.75
const bm25Cache = new Map<number, Bm25Index>()

async function buildBm25Index(repoId: number): Promise<Bm25Index> {
  const cached = bm25Cache.get(repoId)
  if (cached) return cached

  const { rows } = await pool.query(
    `SELECT id, repo_id AS "repoId", file_path AS "filePath",
            line_start AS "lineStart", line_end AS "lineEnd",
            content, language, 0 AS similarity
     FROM code_chunks WHERE repo_id = $1`,
    [repoId]
  )

  const docs: Bm25Doc[] = []
  const df = new Map<string, number>()
  let totalLen = 0

  for (const row of rows as CodeResult[]) {
    const tokens = tokenize(`${row.filePath} ${row.content}`)
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)

    docs.push({ row, tf, len: tokens.length })
    totalLen += tokens.length
  }

  const index: Bm25Index = {
    docs,
    df,
    avgLen: docs.length === 0 ? 1 : totalLen / docs.length,
  }
  bm25Cache.set(repoId, index)
  return index
}

async function bm25Rows(repoId: number, query: string, limit: number): Promise<CodeResult[]> {
  const index = await buildBm25Index(repoId)
  const terms = [...new Set(tokenize(query, { dropStopwords: true }))]
  const N = index.docs.length

  const scored: CodeResult[] = []
  for (const doc of index.docs) {
    let score = 0
    for (const term of terms) {
      const f = doc.tf.get(term)
      if (!f) continue
      const n = index.df.get(term) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      const saturated =
        (f * (BM25_K1 + 1)) /
        (f + BM25_K1 * (1 - BM25_B + BM25_B * (doc.len / index.avgLen)))
      score += idf * saturated
    }
    if (score > 0) scored.push({ ...doc.row, similarity: score })
  }

  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, limit)
}

export const bm25Retriever: Retriever = {
  name: 'bm25',
  label: 'BM25 (in-process)',
  description:
    'Textbook BM25 (k1=1.2, b=0.75) over the same code-aware tokens — a reference point for the Postgres FTS ranking.',
  async prepare(repoId) {
    await buildBm25Index(repoId)
  },
  async retrieve({ repoId, query, k }) {
    return bm25Rows(repoId, query, k)
  },
}

// ── 4. Hybrid: reciprocal rank fusion ─────────────────────────────────────────

export const hybridRetriever: Retriever = {
  name: 'hybrid',
  label: 'Hybrid (dense + lexical, RRF)',
  description:
    'Dense and lexical candidates fused by reciprocal rank (k=60), 30 per arm. This is lib/vector/hybrid.ts measured directly.',
  async retrieve({ repoId, queryEmbedding, query, k }) {
    return searchCodeChunksHybrid([repoId], queryEmbedding, query, k)
  },
}

export const hybridBm25Retriever: Retriever = {
  name: 'hybrid_bm25',
  label: 'Hybrid (dense + BM25, RRF)',
  description: 'The same fusion with BM25 as the lexical arm — an upper bound on what a better lexical ranker would buy.',
  async prepare(repoId) {
    await buildBm25Index(repoId)
  },
  async retrieve({ repoId, queryEmbedding, query, k }) {
    const [dense, bm25] = await Promise.all([
      denseRows(repoId, queryEmbedding, CANDIDATE_POOL),
      bm25Rows(repoId, query, CANDIDATE_POOL),
    ])
    return fuseByReciprocalRank([dense, bm25], k)
  },
}

/**
 * Equal-weight fusion, kept in the table as the thing that did not work — it is
 * the obvious first implementation, and the reason to weight the arms is only
 * legible next to it.
 */
export const hybridEqualRetriever: Retriever = {
  name: 'hybrid_equal',
  label: 'Hybrid (dense + lexical, equal RRF)',
  description: 'Unweighted reciprocal rank fusion — every arm gets the same vote.',
  async retrieve({ repoId, queryEmbedding, query, k }) {
    const [dense, lexical] = await Promise.all([
      denseRows(repoId, queryEmbedding, CANDIDATE_POOL),
      lexicalSearchCodeChunks([repoId], query, CANDIDATE_POOL),
    ])
    return fuseByReciprocalRank([dense, lexical], k)
  },
}

// ── 5. Source-kind prior ──────────────────────────────────────────────────────
//
// Retrieve wider than needed, re-order by similarity x a prior on what kind of
// file the chunk came from, then cut. See lib/vector/source-prior.ts for why.

const PRIOR_POOL = 40

export const denseWithPriorRetriever: Retriever = {
  name: 'dense_prior',
  label: 'Dense + source prior',
  description:
    'Dense top-40 re-ordered by similarity x a weight for implementation vs test/docs/example/config, then cut to k.',
  async retrieve({ repoId, queryEmbedding, query, k }) {
    const candidates = await denseRows(repoId, queryEmbedding, PRIOR_POOL)
    return applySourcePrior(candidates, query, k)
  },
}

export const hybridWithPriorRetriever: Retriever = {
  name: 'hybrid_prior',
  label: 'Hybrid + source prior',
  description: 'Weighted dense+lexical fusion, then the same source-kind re-ordering.',
  async retrieve({ repoId, queryEmbedding, query, k }) {
    const fused = await searchCodeChunksHybrid([repoId], queryEmbedding, query, PRIOR_POOL)
    return applySourcePrior(fused, query, k)
  },
}

export const BASE_RETRIEVERS: Retriever[] = [
  denseRetriever,
  lexicalRetriever,
  bm25Retriever,
  hybridEqualRetriever,
  hybridRetriever,
  hybridBm25Retriever,
  denseWithPriorRetriever,
  hybridWithPriorRetriever,
]
