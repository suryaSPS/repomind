import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// OpenAI allows up to 2048 inputs per request. Larger batches mean far fewer
// HTTP round trips, which is where most of the wall-clock time was going.
const BATCH_SIZE = Number(process.env.OPENAI_EMBED_BATCH_SIZE ?? 256)

// How many embedding requests may be in flight at once. The token budget below
// is the real throttle; concurrency just keeps us near it instead of idling
// between sequential round trips.
const CONCURRENCY = Number(process.env.OPENAI_EMBED_CONCURRENCY ?? 4)

// Tokens-per-minute ceiling for the account (1,000,000 on most tiers for
// text-embedding-3-small). We deliberately spend only part of it so a burst
// never crosses the real limit.
const TPM_LIMIT = Number(process.env.OPENAI_EMBED_TPM ?? 1_000_000)
const TPM_SAFETY = Number(process.env.OPENAI_EMBED_TPM_SAFETY ?? 0.85)
const TPM_BUDGET = Math.floor(TPM_LIMIT * TPM_SAFETY)

const MAX_RETRIES = Number(process.env.OPENAI_EMBED_MAX_RETRIES ?? 8)
const MAX_INPUT_CHARS = 6000

// The endpoint rejects a single request over ~300k tokens. BATCH_SIZE inputs of
// worst-case length would blow past that, so batches are capped by tokens too.
const MAX_BATCH_TOKENS = Number(process.env.OPENAI_EMBED_BATCH_TOKENS ?? 200_000)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** ~4 chars per token is close enough for budgeting, and costs nothing. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Sliding-window token limiter. Records what we spend and makes callers wait
 * until the oldest spend ages out of the 60s window, so we approach the TPM
 * ceiling instead of slamming into it.
 */
class TokenWindow {
  private spends: { at: number; tokens: number }[] = []

  private usedInLastMinute(now: number): number {
    const cutoff = now - 60_000
    while (this.spends.length > 0 && this.spends[0].at < cutoff) {
      this.spends.shift()
    }
    return this.spends.reduce((sum, s) => sum + s.tokens, 0)
  }

  async acquire(tokens: number): Promise<void> {
    // A single request larger than the whole budget can never fit; let it
    // through alone rather than deadlocking.
    const want = Math.min(tokens, TPM_BUDGET)

    for (;;) {
      const now = Date.now()
      const used = this.usedInLastMinute(now)

      if (used + want <= TPM_BUDGET) {
        this.spends.push({ at: now, tokens })
        return
      }

      // Wait for the oldest spend to fall out of the window.
      const oldest = this.spends[0]
      const waitMs = oldest ? Math.max(oldest.at + 60_000 - now, 50) : 1_000
      await sleep(waitMs)
    }
  }

  /** Called after a 429 so the limiter's view reflects the server's. */
  penalize(tokens: number): void {
    this.spends.push({ at: Date.now(), tokens })
  }
}

const tokenWindow = new TokenWindow()

function isRateLimit(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return status === 429
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500) return true
  // Network hiccups surface without a status.
  return status === undefined
}

/**
 * OpenAI tells us exactly how long to wait — either in a retry-after header or
 * in the message ("Please try again in 125ms"). Prefer that over guessing.
 */
function retryAfterMs(err: unknown, attempt: number): number {
  const headers = (err as { headers?: Record<string, string> })?.headers
  const header =
    headers?.['retry-after-ms'] ??
    headers?.['x-ratelimit-reset-tokens'] ??
    headers?.['retry-after']

  if (header) {
    const asMs = Number(header)
    if (Number.isFinite(asMs) && asMs > 0) {
      // `retry-after` is seconds; `retry-after-ms` is milliseconds.
      return headers?.['retry-after-ms'] ? asMs : asMs * 1000
    }
    const match = /([\d.]+)(ms|s)/.exec(header)
    if (match) {
      return match[2] === 'ms' ? Number(match[1]) : Number(match[1]) * 1000
    }
  }

  const message = (err as { message?: string })?.message ?? ''
  const inMessage = /try again in ([\d.]+)(ms|s)/i.exec(message)
  if (inMessage) {
    const value = Number(inMessage[1])
    return inMessage[2].toLowerCase() === 'ms' ? value : value * 1000
  }

  // Exponential backoff with jitter: 1s, 2s, 4s … capped at 30s.
  const base = Math.min(1000 * 2 ** attempt, 30_000)
  return base + Math.random() * 250
}

/**
 * Embed a batch of texts using text-embedding-3-small.
 * Returns one embedding vector per input string.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  // Truncate texts to avoid token limit (8191 tokens max)
  const truncated = texts.map((t) => t.slice(0, MAX_INPUT_CHARS))
  const tokens = truncated.reduce((sum, t) => sum + estimateTokens(t), 0)

  let lastErr: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await tokenWindow.acquire(tokens)

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: truncated,
      })

      return response.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding)
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === MAX_RETRIES) throw err

      // The tokens were charged against the limit even though we got nothing
      // back, so make the limiter account for them before retrying.
      if (isRateLimit(err)) tokenWindow.penalize(tokens)

      await sleep(retryAfterMs(err, attempt))
    }
  }

  throw lastErr
}

/**
 * Embed texts in batches, with a bounded number of batches in flight.
 * Order of the returned vectors always matches the order of `texts`.
 */
export async function embedAll(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  if (texts.length === 0) return []

  // Pre-slice into batches so each worker can claim one by index and write its
  // results back into the right slot. A batch closes when it hits either the
  // input-count cap or the per-request token cap, whichever comes first.
  const batches: { start: number; texts: string[] }[] = []
  let current: string[] = []
  let currentStart = 0
  let currentTokens = 0

  for (let i = 0; i < texts.length; i++) {
    const tokens = estimateTokens(texts[i].slice(0, MAX_INPUT_CHARS))

    if (
      current.length > 0 &&
      (current.length >= BATCH_SIZE || currentTokens + tokens > MAX_BATCH_TOKENS)
    ) {
      batches.push({ start: currentStart, texts: current })
      current = []
      currentStart = i
      currentTokens = 0
    }

    current.push(texts[i])
    currentTokens += tokens
  }
  if (current.length > 0) batches.push({ start: currentStart, texts: current })

  const results: number[][] = new Array(texts.length)
  let nextBatch = 0
  let done = 0

  async function worker() {
    for (;;) {
      const index = nextBatch++
      if (index >= batches.length) return

      const batch = batches[index]
      const embeddings = await embedBatch(batch.texts)

      for (let j = 0; j < embeddings.length; j++) {
        results[batch.start + j] = embeddings[j]
      }

      done += batch.texts.length
      onProgress?.(Math.min(done, texts.length), texts.length)
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, batches.length) },
    () => worker()
  )
  await Promise.all(workers)

  return results
}
