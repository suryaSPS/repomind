import { embedBatch } from '@/lib/ingestion/embedder'
import {
  searchCodeChunks,
  searchCommitChunks,
  searchCodeChunksMulti,
  searchCommitChunksMulti,
  type CodeResult,
  type CommitResult,
} from '@/lib/vector/search'
import { applySourcePrior } from '@/lib/vector/source-prior'
import { createAgentTools, createMultiRepoTools } from './tools'
import { buildSystemPrompt, buildMultiRepoSystemPrompt } from './prompts'

/**
 * Assembly of an agent turn — the model, the system prompt, the pre-retrieved
 * context block, and the tools.
 *
 * This lives outside the route handler so the offline evaluation can measure
 * the same code path the product runs, instead of a reimplementation of it that
 * drifts. `POST /api/chat` keeps the concerns a route owns (auth, transcript
 * persistence, streaming); everything about *how the model is asked* is here.
 */

export const AGENT_MODEL = 'claude-haiku-4-5-20251001'
export const AGENT_MAX_STEPS = 8

/** How many chunks/commits get pushed into the prompt before the model runs. */
export const PREFETCH_CODE = 5
export const PREFETCH_COMMITS = 3
export const PREFETCH_CODE_MULTI = 6
export const PREFETCH_COMMITS_MULTI = 4

export interface RepoRef {
  id: number
  name: string
  url: string
}

export interface PrefetchResult {
  code: CodeResult[]
  commits: CommitResult[]
}

/**
 * Strategy for choosing what to put in front of the model before it can call a
 * tool. Injected rather than hard-coded so alternatives can be A/B tested
 * without forking the prompt.
 */
export type Prefetcher = (
  repoIds: number[],
  question: string,
  isMultiRepo: boolean
) => Promise<PrefetchResult>

/**
 * Plain dense vector search — the behaviour that shipped before the source
 * prior. Kept because the evaluation needs it as a baseline arm.
 */
export const densePrefetcher: Prefetcher = async (repoIds, question, isMultiRepo) => {
  const [queryEmbedding] = await embedBatch([question])

  if (isMultiRepo) {
    const [code, commits] = await Promise.all([
      searchCodeChunksMulti(repoIds, queryEmbedding, PREFETCH_CODE_MULTI),
      searchCommitChunksMulti(repoIds, queryEmbedding, PREFETCH_COMMITS_MULTI),
    ])
    return { code, commits }
  }

  const [code, commits] = await Promise.all([
    searchCodeChunks(repoIds[0], queryEmbedding, PREFETCH_CODE),
    searchCommitChunks(repoIds[0], queryEmbedding, PREFETCH_COMMITS),
  ])
  return { code, commits }
}

/**
 * How many candidates to pull before the source prior re-orders them.
 *
 * Wider than what the prompt keeps, on purpose: the prior earns its place by
 * promoting an implementation chunk that raw similarity ranked below the cut,
 * which it can only do if that chunk was retrieved in the first place.
 */
const PRIOR_POOL = 40

/**
 * Production default: dense retrieval re-ranked by a prior on source kind.
 *
 * Chosen on measurement, not taste. Against the plain dense baseline over 111
 * hand-labelled questions across four repositories, and validated on 70
 * held-out generated ones. Hybrid dense+lexical fusion was tried first and was
 * not better than dense alone; see eval/RESULTS.md for that negative result and
 * for the weight sweep behind lib/vector/source-prior.ts.
 */
export const sourcePriorPrefetcher: Prefetcher = async (repoIds, question, isMultiRepo) => {
  const [queryEmbedding] = await embedBatch([question])

  if (isMultiRepo) {
    const [candidates, commits] = await Promise.all([
      searchCodeChunksMulti(repoIds, queryEmbedding, PRIOR_POOL),
      searchCommitChunksMulti(repoIds, queryEmbedding, PREFETCH_COMMITS_MULTI),
    ])
    return { code: applySourcePrior(candidates, question, PREFETCH_CODE_MULTI), commits }
  }

  const [candidates, commits] = await Promise.all([
    searchCodeChunks(repoIds[0], queryEmbedding, PRIOR_POOL),
    searchCommitChunks(repoIds[0], queryEmbedding, PREFETCH_COMMITS),
  ])
  return { code: applySourcePrior(candidates, question, PREFETCH_CODE), commits }
}

function formatContextBlock(
  { code, commits }: PrefetchResult,
  repoNames: Record<number, string> | null
): string {
  const label = (repoId: number) =>
    repoNames ? `[${repoNames[repoId] ?? 'unknown'}] ` : ''

  const codeContext = code
    .map(
      (r) =>
        `${label(r.repoId)}📄 ${r.filePath}:${r.lineStart}-${r.lineEnd}\n\`\`\`${r.language ?? ''}\n${r.content}\n\`\`\``
    )
    .join('\n\n')

  const commitContext = commits
    .map(
      (r) =>
        `${label(r.repoId)}🔖 ${r.hash.slice(0, 7)} — ${r.author} — ${r.date ? new Date(r.date).toDateString() : 'N/A'}\n${r.message}\nFiles: ${r.filesChanged ?? 'N/A'}`
    )
    .join('\n\n')

  const scope = repoNames
    ? 'most relevant across all repos'
    : 'most relevant to the current question'

  return `\n\n## Pre-retrieved context (${scope}):\n\n### Code:\n${codeContext}\n\n### Recent relevant commits:\n${commitContext}`
}

export interface AgentTurn {
  system: string
  tools: ReturnType<typeof createAgentTools> | ReturnType<typeof createMultiRepoTools>
  /** Files the pre-retrieval put in the prompt — what the answer can be grounded in. */
  prefetchedFiles: string[]
  prefetch: PrefetchResult | null
}

/**
 * Build the system prompt, context block and tool set for one turn.
 * `question` may be null when there is no user turn to retrieve against.
 */
export async function buildAgentTurn(
  repoList: RepoRef[],
  question: string | null,
  prefetcher: Prefetcher = sourcePriorPrefetcher
): Promise<AgentTurn> {
  const repoIds = repoList.map((r) => r.id)
  const isMultiRepo = repoIds.length > 1

  let prefetch: PrefetchResult | null = null
  let contextBlock = ''

  if (question) {
    prefetch = await prefetcher(repoIds, question, isMultiRepo)
    const repoNames = isMultiRepo
      ? Object.fromEntries(repoList.map((r) => [r.id, r.name]))
      : null
    contextBlock = formatContextBlock(prefetch, repoNames)
  }

  if (isMultiRepo) {
    const repoNameMap = Object.fromEntries(repoList.map((r) => [r.id, r.name]))
    return {
      system: buildMultiRepoSystemPrompt(repoList.map((r) => r.name)) + contextBlock,
      tools: createMultiRepoTools(repoIds, repoNameMap),
      prefetchedFiles: [...new Set(prefetch?.code.map((c) => c.filePath) ?? [])],
      prefetch,
    }
  }

  const repo = repoList[0]
  return {
    system: buildSystemPrompt(repo.name, repo.url) + contextBlock,
    tools: createAgentTools(repo.id),
    prefetchedFiles: [...new Set(prefetch?.code.map((c) => c.filePath) ?? [])],
    prefetch,
  }
}
