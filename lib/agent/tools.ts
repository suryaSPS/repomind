import { tool } from 'ai'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { searchCodeChunks, searchCommitChunks } from '@/lib/vector/search'
import { embedBatch } from '@/lib/ingestion/embedder'

function getRepoDiskPath(clonedPath: string | null): string {
  if (!clonedPath) throw new Error('Repo not cloned yet')
  return clonedPath
}

export function createAgentTools(repoId: number, clonedPath: string | null) {
  return {
    // ── Semantic code search ─────────────────────────────────────────────────
    search_code: tool({
      description:
        'Semantic search across all code in the repository. Use this to find relevant code by meaning, not just keywords.',
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
        'Read the contents of a specific file in the repository. Optionally specify line range.',
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
        const repoPath = getRepoDiskPath(clonedPath)
        const fullPath = path.join(repoPath, filePath)

        if (!fullPath.startsWith(repoPath)) {
          return { error: 'Access denied: path outside repository' }
        }

        let content: string
        try {
          content = fs.readFileSync(fullPath, 'utf-8')
        } catch {
          return { error: `File not found: ${filePath}` }
        }

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
        fileGlob: z.string().optional().describe('Optional glob to restrict files e.g. "*.ts"'),
        maxResults: z.number().optional().default(30).describe('Max results'),
      }),
      execute: async ({
        pattern,
        fileGlob,
        maxResults,
      }: {
        pattern: string
        fileGlob?: string
        maxResults?: number
      }) => {
        const repoPath = getRepoDiskPath(clonedPath)
        try {
          const globArg = fileGlob ? `--include="${fileGlob}"` : ''
          const safePattern = pattern.replace(/"/g, '\\"')
          const cmd = `grep -rn --text -l ${globArg} -E "${safePattern}" "${repoPath}" 2>/dev/null | head -10`
          const files = execSync(cmd, { timeout: 10000 }).toString().trim()

          if (!files) return { matches: [], message: 'No matches found' }

          const fileList = files.split('\n').slice(0, 10)
          const results: string[] = []

          for (const file of fileList) {
            try {
              const matchCmd = `grep -n --text -E "${safePattern}" "${file}" 2>/dev/null | head -5`
              const matches = execSync(matchCmd, { timeout: 5000 }).toString().trim()
              const relativePath = path.relative(repoPath, file)
              if (matches) results.push(`📄 ${relativePath}:\n${matches}`)
            } catch { /* skip */ }
          }

          return { matches: results.slice(0, maxResults ?? 30) }
        } catch {
          return { matches: [], message: 'Grep failed or timed out' }
        }
      },
    }),

    // ── Get commit details ───────────────────────────────────────────────────
    get_commit: tool({
      description:
        'Get full details of a specific commit including diff. Use to understand what changed and why.',
      parameters: z.object({
        hash: z.string().describe('Commit hash (full or short 7-char)'),
      }),
      execute: async ({ hash }: { hash: string }) => {
        const repoPath = getRepoDiskPath(clonedPath)
        try {
          const cmd = `git -C "${repoPath}" show --stat --format="Hash: %H%nAuthor: %an <%ae>%nDate: %ad%nMessage: %s%n%n%b" "${hash}" 2>/dev/null | head -100`
          const output = execSync(cmd, { timeout: 10000 }).toString()
          return { commit: output.slice(0, 4000) }
        } catch {
          return { error: `Could not find commit: ${hash}` }
        }
      },
    }),

    // ── List directory ───────────────────────────────────────────────────────
    list_directory: tool({
      description: 'List files and folders in a directory of the repository.',
      parameters: z.object({
        dirPath: z.string().optional().default('.').describe('Relative path (default: root)'),
      }),
      execute: async ({ dirPath }: { dirPath?: string }) => {
        const repoPath = getRepoDiskPath(clonedPath)
        const fullPath = path.join(repoPath, dirPath ?? '.')

        if (!fullPath.startsWith(repoPath)) return { error: 'Access denied' }

        try {
          const entries = fs.readdirSync(fullPath, { withFileTypes: true })
          const files = entries
            .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
            .map((e) => (e.isDirectory() ? `📁 ${e.name}/` : `📄 ${e.name}`))
            .sort()
          return { path: dirPath, entries: files }
        } catch {
          return { error: `Directory not found: ${dirPath}` }
        }
      },
    }),
  }
}
