/**
 * Source-kind prior over retrieval results.
 *
 * The failure mode this exists for, taken from the evaluation set: asking gin
 * "what data structure does the router use to match URLs" returned
 * BENCHMARKS.md, docs/doc.md and routes_test.go — never tree.go, where the
 * radix tree actually lives. Asking for the bare identifier `addRoute` returned
 * gin_test.go, routes_test.go and tree_test.go, again not tree.go.
 *
 * The cause is not a bad embedding. A test file *talks about* a behaviour in
 * plainer language than the implementation does — `TestRouterAddRoute` and a
 * table of URL cases look more like the question than a dense radix-tree
 * traversal does. Documentation is worse still: it is written to answer exactly
 * this kind of question.
 *
 * So similarity alone is the wrong ranking signal. A developer asking how
 * routing works wants the implementation; they only want tests when they say
 * so. That is a prior about the corpus, not about the query, and it belongs
 * after retrieval rather than inside the embedding.
 */

export type SourceKind = 'implementation' | 'test' | 'docs' | 'example' | 'config'

const TEST_PATTERNS = [
  /(^|\/)tests?\//i,
  /(^|\/)testdata\//i,
  /(^|\/)spec\//i,
  /_test\.[a-z]+$/i,
  /\.test\.[a-z]+$/i,
  /\.spec\.[a-z]+$/i,
  /(^|\/)test_[^/]*\.py$/i,
  /(^|\/)conftest\.py$/i,
  /_benchmark\.[a-z]+$/i,
  /benchmarks?_test\.[a-z]+$/i,
]

const EXAMPLE_PATTERNS = [/(^|\/)examples?\//i, /(^|\/)samples?\//i, /(^|\/)demos?\//i]

const DOC_PATTERNS = [/(^|\/)docs?\//i, /\.(md|mdx|rst|txt)$/i]

const CONFIG_PATTERNS = [
  /\.(json|ya?ml|toml|ini|cfg|lock)$/i,
  /(^|\/)\.[^/]+$/, // dotfiles: .gitignore, .golangci.yml
]

export function classifyPath(filePath: string): SourceKind {
  for (const re of TEST_PATTERNS) if (re.test(filePath)) return 'test'
  for (const re of EXAMPLE_PATTERNS) if (re.test(filePath)) return 'example'
  for (const re of DOC_PATTERNS) if (re.test(filePath)) return 'docs'
  for (const re of CONFIG_PATTERNS) if (re.test(filePath)) return 'config'
  return 'implementation'
}

/**
 * Multiplier applied to the similarity of a non-implementation chunk.
 *
 * One knob rather than four, and a mild one, both because the data said so.
 *
 * Sweeping this weight (eval/scripts/sweep-prior.ts) against 111 hand-written
 * questions and 70 held-out generated ones:
 *
 *   weight   gold nDCG@10   held-out nDCG@10
 *   1.00     0.768          0.802     <- no prior
 *   0.95     0.782          0.812
 *   0.90     0.804          0.795     <- shipped
 *   0.85     0.820          0.777
 *   0.70     0.829          0.718
 *
 * The first version of this file used 0.62, which looked best on the
 * hand-written set — the set it had been designed against by reading its
 * failures. On held-out questions 0.62 was a disaster: where the answer really
 * was a test file, nDCG@10 fell from 0.605 to 0.148, because a penalty that
 * large stops being a prior and becomes a filter, dropping every test chunk
 * below every implementation chunk regardless of similarity.
 *
 * 0.9 keeps most of the gain on realistic questions while leaving held-out
 * performance roughly where it started. It is a deliberate bet that a developer
 * asking about behaviour usually wants the implementation — and a bet sized so
 * that being wrong costs a rank or two, not the answer.
 */
export const NON_IMPLEMENTATION_WEIGHT = 0.9

export const DEFAULT_WEIGHTS: Record<SourceKind, number> = {
  implementation: 1.0,
  test: NON_IMPLEMENTATION_WEIGHT,
  docs: NON_IMPLEMENTATION_WEIGHT,
  example: NON_IMPLEMENTATION_WEIGHT,
  config: NON_IMPLEMENTATION_WEIGHT,
}

/**
 * Words that mean the user actually wants the down-weighted material. When the
 * query asks about tests, penalising tests is exactly backwards.
 */
const INTENT_PATTERNS: Record<Exclude<SourceKind, 'implementation'>, RegExp> = {
  test: /\b(test|tests|testing|spec|specs|assert|assertion|fixture|mock|coverage|benchmark)\b/i,
  docs: /\b(doc|docs|documentation|readme|guide|tutorial|changelog)\b/i,
  example: /\b(example|examples|sample|samples|demo|usage)\b/i,
  config: /\b(config|configuration|settings|yaml|yml|toml|json|lockfile|dependency|dependencies)\b/i,
}

/** Which kinds the query explicitly asked for — those keep a weight of 1. */
export function intendedKinds(query: string): Set<SourceKind> {
  const wanted = new Set<SourceKind>(['implementation'])
  for (const [kind, re] of Object.entries(INTENT_PATTERNS)) {
    if (re.test(query)) wanted.add(kind as SourceKind)
  }
  return wanted
}

export function sourceWeight(
  filePath: string,
  wanted: Set<SourceKind>,
  weights: Record<SourceKind, number> = DEFAULT_WEIGHTS
): number {
  const kind = classifyPath(filePath)
  return wanted.has(kind) ? 1 : weights[kind]
}

/**
 * Re-order candidates by similarity × source weight.
 *
 * Callers should hand this a wider candidate list than they intend to keep:
 * the whole point is to promote an implementation chunk that similarity alone
 * ranked below the cut.
 */
export function applySourcePrior<T extends { filePath: string; similarity: number }>(
  candidates: T[],
  query: string,
  limit: number,
  weights: Record<SourceKind, number> = DEFAULT_WEIGHTS
): T[] {
  const wanted = intendedKinds(query)
  return candidates
    .map((c) => ({ ...c, similarity: c.similarity * sourceWeight(c.filePath, wanted, weights) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
}
