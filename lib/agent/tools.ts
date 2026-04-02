import { tool } from 'ai'
import { z } from 'zod'
import {
  searchCodeChunks,
  searchCommitChunks,
  getFileFromDB,
  grepFilesFromDB,
  listFilesFromDB,
  getCommitFromDB,
} from '@/lib/vector/search'
import { embedBatch } from '@/lib/ingestion/embedder'

/**
 * All tools read exclusively from the database.
 * No disk / shell access — works on Vercel, Railway, and local alike.
 */
export function createAgentTools(repoId: number) {
  return {
    // ── Semantic code search ─────────────────────────────────────────────────
    search_code: tool({
      description:
        'Semantic search across all code and commits in the repository. Use this to find relevant code by meaning, not just keywords.',
      parameters: z.object({
        query: z.string().describe('Natural language description of what you are looking for'),
        limit: z.number().optional().default(6).describe('Number of results (default 6)'),
      }),
      execute: async ({ query, limit }: { query: string; limit?: number }) => {
        const [embedding] = await embedBatch([query])
        const codeResults = await searchCodeChunks(repoId, embedding, limit ?? 6)
        const commitResults = await searchCommitChunks(repoId, embedding, 3)

        const codeFormatted = codeResults.map(
          (r) =>
            `📄 ${r.filePath}:${r.lineStart}-${r.lineEnd} (${(r.similarity * 100).toFixed(1)}% match)\n\`\`\`${r.language ?? ''}\n${r.content}\n\`\`\``
        )
        const commitsFormatted = commitResults.map(
          (r) =>
            `🔖 ${r.hash.slice(0, 7)} — ${r.author} — ${r.date ? new Date(r.date).toDateString() : 'unknown'}\n${r.message}\nFiles: ${r.filesChanged ?? 'N/A'}`
        )

        return { codeChunks: codeFormatted, commits: commitsFormatted }
      },
    }),

    // ── Open a specific file ─────────────────────────────────────────────────
    open_file: tool({
      description:
        'Read the contents of a specific file in the repository. Optionally specify a line range.',
      parameters: z.object({
        filePath: z.string().describe('Relative path to the file from repo root'),
        startLine: z.number().optional().describe('Starting line number (1-based)'),
        endLine: z.number().optional().describe('Ending line number (1-based)'),
      }),
      execute: async ({
        filePath,
        startLine,
        endLine,
      }: {
        filePath: string
        startLine?: number
        endLine?: number
      }) => {
        const file = await getFileFromDB(repoId, filePath)
        if (!file) return { error: `File not found: ${filePath}` }

        let content = file.content
        if (startLine !== undefined || endLine !== undefined) {
          const lines = content.split('\n')
          const from = (startLine ?? 1) - 1
          const to = endLine ?? lines.length
          content = lines
            .slice(from, to)
            .map((line, i) => `${from + i + 1}: ${line}`)
            .join('\n')
        }

        return { filePath, content: content.slice(0, 8000) }
      },
    }),

    // ── Grep the repo ────────────────────────────────────────────────────────
    grep_repo: tool({
      description:
        'Search for a regex pattern across all files in the repository. Returns matching lines with file paths.',
      parameters: z.object({
        pattern: z.string().describe('Regex pattern to search for'),
        maxResults: z.number().optional().default(10).describe('Max number of files to return'),
      }),
      execute: async ({
        pattern,
        maxResults,
      }: {
        pattern: string
        maxResults?: number
      }) => {
        try {
          const results = await grepFilesFromDB(repoId, pattern, maxResults ?? 10)
          if (results.length === 0) return { matches: [], message: 'No matches found' }
          const matches = results
            .filter((r) => r.lines.length > 0)
            .map((r) => `📄 ${r.filePath}:\n${r.lines.join('\n')}`)
          return { matches }
        } catch {
          return { matches: [], message: 'Search failed — pattern may be invalid' }
        }
      },
    }),

    // ── Get commit details ───────────────────────────────────────────────────
    get_commit: tool({
      description:
        'Get full details of a specific git commit including the diff. Use to understand what changed and why.',
      parameters: z.object({
        hash: z.string().describe('Commit hash (full or short 7-char)'),
      }),
      execute: async ({ hash }: { hash: string }) => {
        const commit = await getCommitFromDB(repoId, hash)
        if (!commit) return { error: `Commit not found: ${hash}` }
        return {
          hash: commit.hash,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          filesChanged: commit.filesChanged,
          diff: commit.diff ?? 'Diff not stored for this commit',
        }
      },
    }),

    // ── List directory ───────────────────────────────────────────────────────
    list_directory: tool({
      description: 'List files in a directory of the repository.',
      parameters: z.object({
        dirPath: z.string().optional().default('').describe('Relative path prefix (default: root)'),
      }),
      execute: async ({ dirPath }: { dirPath?: string }) => {
        const files = await listFilesFromDB(repoId, dirPath ?? '')
        return { path: dirPath ?? '(root)', entries: files }
      },
    }),
  }
}
