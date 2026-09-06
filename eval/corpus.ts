/**
 * The repositories the evaluation runs against.
 *
 * Three languages on purpose: retrieval quality on TypeScript says little about
 * retrieval quality on Go, and a single-repo number is easy to overfit to.
 * `repomind` is included because its ground truth can be labelled with certainty.
 * `django` is included for scale: three ~100-file repos cannot show whether a
 * retriever holds up when the candidate set is an order of magnitude larger.
 */
export interface CorpusEntry {
  key: string
  url: string
  owner: string
  name: string
  language: string
}

export const CORPUS: CorpusEntry[] = [
  {
    key: 'repomind',
    url: 'https://github.com/suryaSPS/repomind',
    owner: 'suryaSPS',
    name: 'repomind',
    language: 'TypeScript',
  },
  {
    key: 'flask',
    url: 'https://github.com/pallets/flask',
    owner: 'pallets',
    name: 'flask',
    language: 'Python',
  },
  {
    key: 'django',
    url: 'https://github.com/django/django',
    owner: 'django',
    name: 'django',
    language: 'Python',
  },
  {
    key: 'gin',
    url: 'https://github.com/gin-gonic/gin',
    owner: 'gin-gonic',
    name: 'gin',
    language: 'Go',
  },
]

export function corpusByKey(key: string): CorpusEntry {
  const entry = CORPUS.find((c) => c.key === key)
  if (!entry) throw new Error(`Unknown corpus key: ${key}`)
  return entry
}
