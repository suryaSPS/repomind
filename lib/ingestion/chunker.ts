import fs from 'fs'

const CHUNK_LINES = 60   // target lines per chunk
const OVERLAP_LINES = 10 // lines of overlap between chunks

export interface Chunk {
  content: string
  lineStart: number  // 1-based
  lineEnd: number    // 1-based
}

/**
 * Splits a file into overlapping line-based chunks.
 * Falls back gracefully if the file can't be read.
 */
export function chunkFile(filePath: string): Chunk[] {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return []
  }

  // Skip files with non-printable characters (binary)
  if (/[\x00-\x08\x0e-\x1f]/.test(content.slice(0, 1000))) return []

  const lines = content.split('\n')
  const chunks: Chunk[] = []

  // If the whole file fits in one chunk, don't split
  if (lines.length <= CHUNK_LINES) {
    if (content.trim().length === 0) return []
    return [{ content, lineStart: 1, lineEnd: lines.length }]
  }

  let i = 0
  while (i < lines.length) {
    const start = i
    const end = Math.min(i + CHUNK_LINES, lines.length)
    const chunkLines = lines.slice(start, end)
    const chunkContent = chunkLines.join('\n').trim()

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        lineStart: start + 1,
        lineEnd: end,
      })
    }

    i += CHUNK_LINES - OVERLAP_LINES
    if (i >= lines.length) break
  }

  return chunks
}
