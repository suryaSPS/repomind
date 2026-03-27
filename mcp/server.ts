#!/usr/bin/env node
/**
 * RepoMind MCP Server
 *
 * Exposes RepoMind's search_code, open_file, grep_repo, and get_commit tools
 * as an MCP (Model Context Protocol) server so they can be used inside
 * Claude Desktop, Cursor, or any MCP-compatible IDE.
 *
 * Usage:
 *   npx tsx mcp/server.ts --repoId=1
 *
 * Claude Desktop config (~/.claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "repomind": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/repomind/mcp/server.ts", "--repoId=1"],
 *       "env": {
 *         "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/repomind",
 *         "OPENAI_API_KEY": "sk-..."
 *       }
 *     }
 *   }
 * }
 */

import * as readline from 'readline'
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// ─── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const repoIdArg = args.find((a) => a.startsWith('--repoId='))
const REPO_ID = repoIdArg ? Number(repoIdArg.split('=')[1]) : null

if (!REPO_ID) {
  console.error('Usage: npx tsx mcp/server.ts --repoId=<id>')
  process.exit(1)
}

// ─── Lazy DB + vector imports (avoids loading at startup) ─────────────────────
async function getRepoInfo() {
  const { db } = await import('../lib/db/index.js')
  const { repos } = await import('../lib/db/schema.js')
  const { eq } = await import('drizzle-orm')
  const [repo] = await db.select().from(repos).where(eq(repos.id, REPO_ID!)).limit(1)
  return repo
}

async function doSearchCode(query: string, limit = 6) {
  const { embedBatch } = await import('../lib/ingestion/embedder.js')
  const { searchCodeChunks, searchCommitChunks } = await import('../lib/vector/search.js')
  const [embedding] = await embedBatch([query])
  const code = await searchCodeChunks(REPO_ID!, embedding, limit)
  const commits = await searchCommitChunks(REPO_ID!, embedding, 3)
  return { code, commits }
}

// ─── MCP JSON-RPC over stdio ──────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin })

function send(obj: object) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

const TOOLS = [
  {
    name: 'search_code',
    description: 'Semantic search across all code and commits in the repository.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results (default 6)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'open_file',
    description: 'Read a specific file from the repository.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative path from repo root' },
        startLine: { type: 'number' },
        endLine: { type: 'number' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'grep_repo',
    description: 'Regex search across all files in the repository.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        fileGlob: { type: 'string', description: 'Optional file glob e.g. *.ts' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'get_commit',
    description: 'Get full details of a git commit by hash.',
    inputSchema: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'Commit hash (full or short)' },
      },
      required: ['hash'],
    },
  },
]

rl.on('line', async (line) => {
  let req: { id: string | number; method: string; params?: Record<string, unknown> }
  try {
    req = JSON.parse(line)
  } catch {
    return
  }

  const { id, method, params } = req

  // ── initialize ───────────────────────────────────────────────────────────────
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'repomind', version: '1.0.0' },
      },
    })
    return
  }

  // ── tools/list ───────────────────────────────────────────────────────────────
  if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
    return
  }

  // ── tools/call ───────────────────────────────────────────────────────────────
  if (method === 'tools/call') {
    const toolName = (params as Record<string, unknown>)?.name as string
    const input = (params as Record<string, unknown>)?.arguments as Record<string, unknown>

    try {
      const repo = await getRepoInfo()
      if (!repo) {
        send({ jsonrpc: '2.0', id, error: { code: -32000, message: 'Repo not found' } })
        return
      }

      let resultText = ''

      if (toolName === 'search_code') {
        const { code, commits } = await doSearchCode(input.query as string, (input.limit as number) ?? 6)
        const codeStr = code.map(r => `📄 ${r.filePath}:${r.lineStart}-${r.lineEnd}\n${r.content}`).join('\n\n')
        const commitStr = commits.map(r => `🔖 ${r.hash.slice(0,7)} ${r.message} — ${r.author}`).join('\n')
        resultText = `### Code Results\n${codeStr}\n\n### Commit Results\n${commitStr}`

      } else if (toolName === 'open_file') {
        const fullPath = path.join(repo.clonedPath!, input.filePath as string)
        if (!fullPath.startsWith(repo.clonedPath!)) {
          resultText = 'Error: access denied'
        } else {
          let content = fs.readFileSync(fullPath, 'utf-8')
          if (input.startLine || input.endLine) {
            const lines = content.split('\n')
            const from = ((input.startLine as number) ?? 1) - 1
            const to = (input.endLine as number) ?? lines.length
            content = lines.slice(from, to).map((l, i) => `${from + i + 1}: ${l}`).join('\n')
          }
          resultText = content.slice(0, 8000)
        }

      } else if (toolName === 'grep_repo') {
        const safe = (input.pattern as string).replace(/"/g, '\\"')
        const glob = input.fileGlob ? `--include="${input.fileGlob}"` : ''
        const out = execSync(
          `grep -rn --text -l ${glob} -E "${safe}" "${repo.clonedPath}" 2>/dev/null | head -5`,
          { timeout: 8000 }
        ).toString().trim()
        resultText = out || 'No matches found'

      } else if (toolName === 'get_commit') {
        const out = execSync(
          `git -C "${repo.clonedPath}" show --stat "${input.hash}" 2>/dev/null | head -60`,
          { timeout: 8000 }
        ).toString()
        resultText = out.slice(0, 3000) || `Commit ${input.hash} not found`
      }

      send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: resultText }] },
      })
    } catch (err) {
      send({
        jsonrpc: '2.0', id,
        error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
      })
    }
    return
  }

  // Unknown method
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } })
})

process.stderr.write(`RepoMind MCP server started (repoId=${REPO_ID})\n`)
