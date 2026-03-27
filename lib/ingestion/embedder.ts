import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const BATCH_SIZE = 100 // OpenAI allows up to 2048 inputs per request, keep conservative

/**
 * Embed a batch of texts using text-embedding-3-small.
 * Returns one embedding vector per input string.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  // Truncate texts to avoid token limit (8191 tokens max)
  const truncated = texts.map((t) => t.slice(0, 6000))

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: truncated,
  })

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

/**
 * Embed texts in batches, calling embedBatch multiple times if needed.
 */
export async function embedAll(
  texts: string[],
  onProgress?: (done: number, total: number) => void
): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const embeddings = await embedBatch(batch)
    results.push(...embeddings)
    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length)
  }
  return results
}
