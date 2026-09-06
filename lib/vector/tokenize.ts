/**
 * Code-aware tokenization.
 *
 * Standard English text search is a poor fit for source code: `getGitHubToken`
 * is one token to Postgres, so a developer asking "how is the github token
 * fetched" matches nothing. Splitting camelCase, snake_case and path separators
 * — while *keeping* the original identifier — lets both the whole symbol and its
 * parts match.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'have', 'has', 'had', 'having',
  'i', 'we', 'you', 'it', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in', 'on', 'at',
  'by', 'for', 'with', 'from', 'as', 'into', 'about', 'against',
  'how', 'what', 'where', 'when', 'why', 'which', 'who', 'whom',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might', 'must',
  'does', 'not', 'no', 'so', 'than', 'too', 'very', 'just',
  'code', 'repo', 'repository', 'file', 'files', 'function', 'method',
])

/** Insert spaces at camelCase and acronym boundaries: `getHTTPToken` → `get HTTP Token`. */
export function splitCamel(text: string): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

/**
 * Tokens for indexing/querying: lowercase alphanumerics, with each compound
 * identifier contributing both itself and its parts.
 */
export function tokenize(text: string, opts: { dropStopwords?: boolean } = {}): string[] {
  const raw = text.match(/[A-Za-z_][A-Za-z0-9_]*|\d+/g) ?? []
  const tokens: string[] = []

  for (const word of raw) {
    const lower = word.toLowerCase()
    tokens.push(lower)

    // Only bother splitting compounds — a plain word is already its own part.
    if (/[_A-Z]/.test(word.slice(1))) {
      for (const part of splitCamel(word).split(/[_\s]+/)) {
        const p = part.toLowerCase()
        if (p && p !== lower) tokens.push(p)
      }
    }
  }

  const filtered = opts.dropStopwords
    ? tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1)
    : tokens

  return filtered
}

/**
 * Build a Postgres tsquery from a natural-language question.
 *
 * OR rather than AND: a full question ANDed against a 60-line chunk matches
 * nothing, and `ts_rank_cd` already rewards chunks that cover more of the terms.
 */
export function toTsQuery(question: string): string {
  const tokens = [...new Set(tokenize(question, { dropStopwords: true }))]
  if (tokens.length === 0) return ''
  // Single-quote each lexeme so punctuation-adjacent tokens can't break the parse.
  return tokens.map((t) => `'${t.replace(/'/g, "''")}'`).join(' | ')
}
