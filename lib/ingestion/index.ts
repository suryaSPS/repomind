import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { cloneRepo, getGitLog, getRepoPath } from './clone'
import { walkRepo } from './walker'
import { chunkFile } from './chunker'
import { embedAll } from './embedder'
import { insertCodeChunks, insertCommitChunks, deleteRepoChunks } from '@/lib/vector/search'

export interface IngestionProgress {
  stage: string
  percent: number   // 0-100
  detail?: string
}

/**
 * Full ingestion pipeline for a GitHub repo URL.
 * Calls onProgress with live updates throughout.
 */
export async function ingestRepo(
  repoId: number,
  url: string,
  onProgress: (p: IngestionProgress) => void
): Promise<void> {
  const updateStatus = async (status: string, errorMessage?: string) => {
    await db
      .update(repos)
      .set({ status, errorMessage: errorMessage ?? null, updatedAt: new Date() })
      .where(eq(repos.id, repoId))
  }

  try {
    await updateStatus('processing')

    // ── 1. Clone ──────────────────────────────────────────────────────────────
    onProgress({ stage: 'Cloning repository…', percent: 2 })
    const repoPath = await cloneRepo(url, (stage, pct) => {
      onProgress({ stage, percent: pct })
    })

    await db
      .update(repos)
      .set({ clonedPath: repoPath, updatedAt: new Date() })
      .where(eq(repos.id, repoId))

    // ── 2. Walk files ─────────────────────────────────────────────────────────
    onProgress({ stage: 'Scanning files…', percent: 15 })
    const files = walkRepo(repoPath)
    onProgress({
      stage: 'Scanning files…',
      percent: 18,
      detail: `Found ${files.length} files`,
    })

    // ── 3. Chunk all files ────────────────────────────────────────────────────
    onProgress({ stage: 'Chunking code…', percent: 20 })
    const allChunks: {
      filePath: string
      language: string
      lineStart: number
      lineEnd: number
      content: string
    }[] = []

    for (const file of files) {
      const chunks = chunkFile(file.absolutePath)
      for (const chunk of chunks) {
        allChunks.push({
          filePath: file.relativePath,
          language: file.language,
          lineStart: chunk.lineStart,
          lineEnd: chunk.lineEnd,
          content: chunk.content,
        })
      }
    }

    onProgress({
      stage: 'Chunking code…',
      percent: 30,
      detail: `${allChunks.length} chunks from ${files.length} files`,
    })

    // ── 4. Embed code chunks ──────────────────────────────────────────────────
    onProgress({ stage: 'Embedding code…', percent: 32 })

    // Clear any existing chunks for this repo (re-ingest)
    await deleteRepoChunks(repoId)

    const chunkTexts = allChunks.map(
      (c) => `File: ${c.filePath}\n\n${c.content}`
    )

    const codeEmbeddings = await embedAll(chunkTexts, (done, total) => {
      const pct = 32 + Math.floor((done / total) * 30)
      onProgress({
        stage: 'Embedding code…',
        percent: pct,
        detail: `${done}/${total} chunks`,
      })
    })

    // ── 5. Store code chunks ──────────────────────────────────────────────────
    onProgress({ stage: 'Storing vectors…', percent: 63 })

    const STORE_BATCH = 200
    for (let i = 0; i < allChunks.length; i += STORE_BATCH) {
      const batch = allChunks.slice(i, i + STORE_BATCH)
      const embBatch = codeEmbeddings.slice(i, i + STORE_BATCH)
      await insertCodeChunks(
        batch.map((c, j) => ({ repoId, ...c, embedding: embBatch[j] }))
      )
    }

    onProgress({ stage: 'Storing vectors…', percent: 68 })

    // ── 6. Parse git history ──────────────────────────────────────────────────
    onProgress({ stage: 'Parsing git history…', percent: 70 })
    const commits = await getGitLog(repoPath)
    onProgress({
      stage: 'Parsing git history…',
      percent: 73,
      detail: `${commits.length} commits`,
    })

    // ── 7. Embed commits ──────────────────────────────────────────────────────
    onProgress({ stage: 'Embedding commits…', percent: 75 })
    const commitTexts = commits.map(
      (c) =>
        `Commit: ${c.hash}\nAuthor: ${c.author}\nDate: ${c.date.toISOString()}\nMessage: ${c.message}\nFiles: ${c.filesChanged.join(', ')}`
    )

    const commitEmbeddings = await embedAll(commitTexts, (done, total) => {
      const pct = 75 + Math.floor((done / total) * 15)
      onProgress({
        stage: 'Embedding commits…',
        percent: pct,
        detail: `${done}/${total} commits`,
      })
    })

    // ── 8. Store commits ──────────────────────────────────────────────────────
    onProgress({ stage: 'Storing commits…', percent: 91 })
    for (let i = 0; i < commits.length; i += STORE_BATCH) {
      const batch = commits.slice(i, i + STORE_BATCH)
      const embBatch = commitEmbeddings.slice(i, i + STORE_BATCH)
      await insertCommitChunks(
        batch.map((c, j) => ({
          repoId,
          hash: c.hash,
          message: c.message,
          author: c.author,
          date: c.date,
          filesChanged: c.filesChanged.join(', '),
          embedding: embBatch[j],
        }))
      )
    }

    // ── 9. Finalize ───────────────────────────────────────────────────────────
    await db
      .update(repos)
      .set({
        status: 'ready',
        fileCount: files.length,
        commitCount: commits.length,
        updatedAt: new Date(),
      })
      .where(eq(repos.id, repoId))

    onProgress({ stage: 'Ready!', percent: 100 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateStatus('error', message)
    throw err
  }
}
