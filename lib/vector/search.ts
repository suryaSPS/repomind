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
  diff: string | null
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
       files_changed as "filesChanged", diff,
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
 * Search code chunks across multiple repos at once.
 */
export async function searchCodeChunksMulti(
  repoIds: number[],
  queryEmbedding: number[],
  limit = 5
): Promise<CodeResult[]> {
  if (repoIds.length === 0) return []
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const placeholders = repoIds.map((_, i) => `$${i + 2}`).join(', ')
  const result = await pool.query(
    `SELECT
       id, repo_id as "repoId", file_path as "filePath",
       line_start as "lineStart", line_end as "lineEnd",
       content, language,
       1 - (embedding <=> $1::vector) as similarity
     FROM code_chunks
     WHERE repo_id IN (${placeholders})
     ORDER BY embedding <=> $1::vector
     LIMIT $${repoIds.length + 2}`,
    [vectorStr, ...repoIds, limit]
  )
  return result.rows
}

/**
 * Search commit chunks across multiple repos at once.
 */
export async function searchCommitChunksMulti(
  repoIds: number[],
  queryEmbedding: number[],
  limit = 3
): Promise<CommitResult[]> {
  if (repoIds.length === 0) return []
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const placeholders = repoIds.map((_, i) => `$${i + 2}`).join(', ')
  const result = await pool.query(
    `SELECT
       id, repo_id as "repoId", hash, message, author, date,
       files_changed as "filesChanged", diff,
       1 - (embedding <=> $1::vector) as similarity
     FROM commit_chunks
     WHERE repo_id IN (${placeholders})
     ORDER BY embedding <=> $1::vector
     LIMIT $${repoIds.length + 2}`,
    [vectorStr, ...repoIds, limit]
  )
  return result.rows
}

/** Read a file from DB across multiple repos (tries each). */
export async function getFileFromDBMulti(
  repoIds: number[],
  filePath: string
): Promise<{ repoId: number; content: string; language: string | null } | null> {
  if (repoIds.length === 0) return null
  const placeholders = repoIds.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `SELECT repo_id as "repoId", content, language FROM repo_files
     WHERE repo_id IN (${placeholders}) AND file_path = $${repoIds.length + 1} LIMIT 1`,
    [...repoIds, filePath]
  )
  return result.rows[0] ?? null
}

/** Grep files across multiple repos. */
export async function grepFilesFromDBMulti(
  repoIds: number[],
  pattern: string,
  limit = 10
): Promise<{ repoId: number; filePath: string; lines: string[] }[]> {
  if (repoIds.length === 0) return []
  const placeholders = repoIds.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `SELECT repo_id as "repoId", file_path as "filePath", content FROM repo_files
     WHERE repo_id IN (${placeholders}) AND content ~* $${repoIds.length + 1} LIMIT $${repoIds.length + 2}`,
    [...repoIds, pattern, limit]
  )
  return result.rows.map((row: { repoId: number; filePath: string; content: string }) => {
    const lines = row.content
      .split('\n')
      .map((line: string, i: number) => ({ line, num: i + 1 }))
      .filter(({ line }: { line: string }) => new RegExp(pattern, 'i').test(line))
      .slice(0, 5)
      .map(({ line, num }: { line: string; num: number }) => `${num}: ${line}`)
    return { repoId: row.repoId, filePath: row.filePath, lines }
  })
}

/** List files across multiple repos. */
export async function listFilesFromDBMulti(repoIds: number[], dirPrefix = ''): Promise<{ repoId: number; filePath: string }[]> {
  if (repoIds.length === 0) return []
  const placeholders = repoIds.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `SELECT DISTINCT repo_id as "repoId", file_path as "filePath" FROM repo_files
     WHERE repo_id IN (${placeholders}) AND file_path LIKE $${repoIds.length + 1} ORDER BY file_path LIMIT 100`,
    [...repoIds, dirPrefix ? `${dirPrefix}%` : '%']
  )
  return result.rows
}

/** Get a commit by hash across multiple repos. */
export async function getCommitFromDBMulti(repoIds: number[], hash: string): Promise<CommitResult | null> {
  if (repoIds.length === 0) return null
  const placeholders = repoIds.map((_, i) => `$${i + 1}`).join(', ')
  const result = await pool.query(
    `SELECT id, repo_id as "repoId", hash, message, author, date,
            files_changed as "filesChanged", diff, 0 as similarity
     FROM commit_chunks WHERE repo_id IN (${placeholders}) AND hash LIKE $${repoIds.length + 1} LIMIT 1`,
    [...repoIds, `${hash}%`]
  )
  return result.rows[0] ?? null
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
    diff?: string | null
    embedding: number[]
  }[]
) {
  if (chunks.length === 0) return
  const values = chunks
    .map(
      (_, i) =>
        `($${i * 8 + 1}, $${i * 8 + 2}, $${i * 8 + 3}, $${i * 8 + 4}, $${i * 8 + 5}, $${i * 8 + 6}, $${i * 8 + 7}, $${i * 8 + 8}::vector)`
    )
    .join(', ')
  const params = chunks.flatMap((c) => [
    c.repoId,
    c.hash,
    c.message,
    c.author,
    c.date.toISOString(),
    c.filesChanged,
    c.diff ?? null,
    `[${c.embedding.join(',')}]`,
  ])
  await pool.query(
    `INSERT INTO commit_chunks (repo_id, hash, message, author, date, files_changed, diff, embedding)
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

/** Read a single file's content from the DB (replaces disk read on Vercel). */
export async function getFileFromDB(
  repoId: number,
  filePath: string
): Promise<{ content: string; language: string | null } | null> {
  const result = await pool.query(
    `SELECT content, language FROM repo_files WHERE repo_id = $1 AND file_path = $2 LIMIT 1`,
    [repoId, filePath]
  )
  return result.rows[0] ?? null
}

/** Grep files stored in DB using Postgres regex (replaces shell grep on Vercel). */
export async function grepFilesFromDB(
  repoId: number,
  pattern: string,
  limit = 10
): Promise<{ filePath: string; lines: string[] }[]> {
  const result = await pool.query(
    `SELECT file_path as "filePath", content FROM repo_files
     WHERE repo_id = $1 AND content ~* $2 LIMIT $3`,
    [repoId, pattern, limit]
  )
  return result.rows.map((row: { filePath: string; content: string }) => {
    const lines = row.content
      .split('\n')
      .map((line: string, i: number) => ({ line, num: i + 1 }))
      .filter(({ line }: { line: string }) => new RegExp(pattern, 'i').test(line))
      .slice(0, 5)
      .map(({ line, num }: { line: string; num: number }) => `${num}: ${line}`)
    return { filePath: row.filePath, lines }
  })
}

/** List files stored in DB for a repo path prefix. */
export async function listFilesFromDB(repoId: number, dirPrefix = ''): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT file_path as "filePath" FROM repo_files
     WHERE repo_id = $1 AND file_path LIKE $2 ORDER BY file_path LIMIT 100`,
    [repoId, dirPrefix ? `${dirPrefix}%` : '%']
  )
  return result.rows.map((r: { filePath: string }) => r.filePath)
}

/** Get a commit by hash from DB (replaces git show on Vercel). */
export async function getCommitFromDB(repoId: number, hash: string): Promise<CommitResult | null> {
  const result = await pool.query(
    `SELECT id, repo_id as "repoId", hash, message, author, date,
            files_changed as "filesChanged", diff, 0 as similarity
     FROM commit_chunks WHERE repo_id = $1 AND hash LIKE $2 LIMIT 1`,
    [repoId, `${hash}%`]
  )
  return result.rows[0] ?? null
}
