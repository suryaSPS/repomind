import { pool } from '@/lib/db'

export interface CodeResult {
  id: number
  repoId: number
  filePath: string
  lineStart: number
  lineEnd: number
  content: string
  language: string | null
  similarity: number
}

export interface CommitResult {
  id: number
  repoId: number
  hash: string
  message: string
  author: string | null
  date: Date | null
  filesChanged: string | null
  similarity: number
}

/**
 * Find the most semantically similar code chunks for a query embedding.
 */
export async function searchCodeChunks(
  repoId: number,
  queryEmbedding: number[],
  limit = 5
): Promise<CodeResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const result = await pool.query(
    `SELECT
       id, repo_id as "repoId", file_path as "filePath",
       line_start as "lineStart", line_end as "lineEnd",
       content, language,
       1 - (embedding <=> $1::vector) as similarity
     FROM code_chunks
     WHERE repo_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, repoId, limit]
  )
  return result.rows
}

/**
 * Find the most semantically similar commits for a query embedding.
 */
export async function searchCommitChunks(
  repoId: number,
  queryEmbedding: number[],
  limit = 3
): Promise<CommitResult[]> {
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const result = await pool.query(
    `SELECT
       id, repo_id as "repoId", hash, message, author, date,
       files_changed as "filesChanged",
       1 - (embedding <=> $1::vector) as similarity
     FROM commit_chunks
     WHERE repo_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, repoId, limit]
  )
  return result.rows
}

/**
 * Insert code chunks in batch (with embeddings).
 */
export async function insertCodeChunks(
  chunks: {
    repoId: number
    filePath: string
    lineStart: number
    lineEnd: number
    content: string
    language: string
    embedding: number[]
  }[]
) {
  if (chunks.length === 0) return
  const values = chunks
    .map(
      (_, i) =>
        `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7}::vector)`
    )
    .join(', ')
  const params = chunks.flatMap((c) => [
    c.repoId,
    c.filePath,
    c.lineStart,
    c.lineEnd,
    c.content,
    c.language,
    `[${c.embedding.join(',')}]`,
  ])
  await pool.query(
    `INSERT INTO code_chunks (repo_id, file_path, line_start, line_end, content, language, embedding)
     VALUES ${values}`,
    params
  )
}

/**
 * Insert commit chunks in batch (with embeddings).
 */
export async function insertCommitChunks(
  chunks: {
    repoId: number
    hash: string
    message: string
    author: string
    date: Date
    filesChanged: string
    embedding: number[]
  }[]
) {
  if (chunks.length === 0) return
  const values = chunks
    .map(
      (_, i) =>
        `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7}::vector)`
    )
    .join(', ')
  const params = chunks.flatMap((c) => [
    c.repoId,
    c.hash,
    c.message,
    c.author,
    c.date.toISOString(),
    c.filesChanged,
    `[${c.embedding.join(',')}]`,
  ])
  await pool.query(
    `INSERT INTO commit_chunks (repo_id, hash, message, author, date, files_changed, embedding)
     VALUES ${values}`,
    params
  )
}

/**
 * Delete all chunks for a repo (for re-ingestion).
 */
export async function deleteRepoChunks(repoId: number) {
  await pool.query('DELETE FROM code_chunks WHERE repo_id = $1', [repoId])
  await pool.query('DELETE FROM commit_chunks WHERE repo_id = $1', [repoId])
}
