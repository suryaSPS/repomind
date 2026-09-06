/**
 * Citation extraction and checking.
 *
 * RepoMind's core promise is "every answer links to exact file paths and line
 * numbers". That promise has a specific failure mode — a confident citation of
 * a path that does not exist — and it is checkable without a model, so it is
 * checked without one.
 */

/**
 * Matches a repo-relative path with a known source extension, optionally
 * followed by `:12` or `:12-34`. Deliberately conservative: it will miss
 * extensionless files (Dockerfile, Makefile) rather than sweep up prose.
 */
const CITATION_RE =
  /\b([A-Za-z0-9_.\-[\]]+(?:\/[A-Za-z0-9_.\-[\]]+)*\.(?:tsx?|jsx?|mjs|cjs|py|go|rb|rs|java|kt|swift|c|cpp|h|hpp|cs|php|vue|svelte|astro|md|mdx|ya?ml|toml|sql|sh|bash|css|scss|html|json))(?::(\d+)(?:-(\d+))?)?/g

export interface Citation {
  filePath: string
  lineStart?: number
  lineEnd?: number
}

export function extractCitations(answer: string): Citation[] {
  const seen = new Map<string, Citation>()

  for (const match of answer.matchAll(CITATION_RE)) {
    const filePath = match[1]
    // Bare filenames with no directory are usually prose ("package.json says…")
    // rather than a citation; keep them only when they carry a line number.
    if (!filePath.includes('/') && !match[2]) continue

    const existing = seen.get(filePath)
    const citation: Citation = {
      filePath,
      lineStart: match[2] ? Number(match[2]) : undefined,
      lineEnd: match[3] ? Number(match[3]) : undefined,
    }
    // Prefer the most specific mention of a given path.
    if (!existing || (!existing.lineStart && citation.lineStart)) {
      seen.set(filePath, citation)
    }
  }

  return [...seen.values()]
}

export interface CitationScores {
  cited: number
  /** Cited paths that exist in the indexed repo. */
  valid: number
  /** Cited paths that do not exist — the answer invented them. */
  hallucinated: number
  hallucinatedPaths: string[]
  /** Did the answer cite at least one file the label says is relevant? */
  hitGold: boolean
  /** Fraction of the labelled files the answer actually cited. */
  goldCoverage: number
  /** Fraction of cited paths that exist. 1 when nothing was cited. */
  validRate: number
}

export function scoreCitations(
  citations: Citation[],
  indexedFiles: Set<string>,
  relevantFiles: string[]
): CitationScores {
  const paths = citations.map((c) => c.filePath)
  const valid = paths.filter((p) => indexedFiles.has(p))
  const hallucinatedPaths = paths.filter((p) => !indexedFiles.has(p))
  const goldHits = relevantFiles.filter((f) => paths.includes(f))

  return {
    cited: paths.length,
    valid: valid.length,
    hallucinated: hallucinatedPaths.length,
    hallucinatedPaths,
    hitGold: goldHits.length > 0,
    goldCoverage: relevantFiles.length === 0 ? 0 : goldHits.length / relevantFiles.length,
    validRate: paths.length === 0 ? 1 : valid.length / paths.length,
  }
}
