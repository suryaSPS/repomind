import { auth } from '@/lib/auth'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { db } from '@/lib/db'
import { repos, messages, chatSessions } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { createAgentTools, createMultiRepoTools } from '@/lib/agent/tools'
import { buildSystemPrompt, buildMultiRepoSystemPrompt } from '@/lib/agent/prompts'
import {
  searchCodeChunks,
  searchCommitChunks,
  searchCodeChunksMulti,
  searchCommitChunksMulti,
} from '@/lib/vector/search'
import { embedBatch } from '@/lib/ingestion/embedder'

export const maxDuration = 120

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const { messages: clientMessages, sessionId } = body

  // Support both single repoId and multi repoIds
  const repoIds: number[] = body.repoIds
    ? body.repoIds.map(Number)
    : body.repoId
      ? [Number(body.repoId)]
      : []

  if (repoIds.length === 0 || !clientMessages) {
    return new Response('Missing repoId(s) or messages', { status: 400 })
  }

  const isMultiRepo = repoIds.length > 1

  // Fetch all repo info
  const repoList = await db
    .select()
    .from(repos)
    .where(inArray(repos.id, repoIds))

  if (repoList.length === 0) return new Response('Repos not found', { status: 404 })

  const notReady = repoList.find((r) => r.status !== 'ready')
  if (notReady) {
    return new Response(`Repo "${notReady.name}" not yet indexed`, { status: 400 })
  }

  try {
    const lastUserMessage = [...clientMessages]
      .reverse()
      .find((m: { role: string; content: string }) => m.role === 'user')

    // Pre-fetch context
    let contextBlock = ''
    if (lastUserMessage?.content) {
      const [queryEmbedding] = await embedBatch([lastUserMessage.content])

      if (isMultiRepo) {
        const codeResults = await searchCodeChunksMulti(repoIds, queryEmbedding, 6)
        const commitResults = await searchCommitChunksMulti(repoIds, queryEmbedding, 4)

        const repoNameMap: Record<number, string> = {}
        for (const r of repoList) repoNameMap[r.id] = r.name

        const codeContext = codeResults
          .map(
            (r) =>
              `[${repoNameMap[r.repoId] ?? 'unknown'}] 📄 ${r.filePath}:${r.lineStart}-${r.lineEnd}\n\`\`\`${r.language ?? ''}\n${r.content}\n\`\`\``
          )
          .join('\n\n')

        const commitContext = commitResults
          .map(
            (r) =>
              `[${repoNameMap[r.repoId] ?? 'unknown'}] 🔖 ${r.hash.slice(0, 7)} — ${r.author} — ${r.date ? new Date(r.date).toDateString() : 'N/A'}\n${r.message}\nFiles: ${r.filesChanged ?? 'N/A'}`
          )
          .join('\n\n')

        contextBlock = `\n\n## Pre-retrieved context (most relevant across all repos):\n\n### Code:\n${codeContext}\n\n### Recent relevant commits:\n${commitContext}`
      } else {
        const codeResults = await searchCodeChunks(repoIds[0], queryEmbedding, 5)
        const commitResults = await searchCommitChunks(repoIds[0], queryEmbedding, 3)

        const codeContext = codeResults
          .map(
            (r) =>
              `📄 ${r.filePath}:${r.lineStart}-${r.lineEnd}\n\`\`\`${r.language ?? ''}\n${r.content}\n\`\`\``
          )
          .join('\n\n')

        const commitContext = commitResults
          .map(
            (r) =>
              `🔖 ${r.hash.slice(0, 7)} — ${r.author} — ${r.date ? new Date(r.date).toDateString() : 'N/A'}\n${r.message}\nFiles: ${r.filesChanged ?? 'N/A'}`
          )
          .join('\n\n')

        contextBlock = `\n\n## Pre-retrieved context (most relevant to the current question):\n\n### Code:\n${codeContext}\n\n### Recent relevant commits:\n${commitContext}`
      }
    }

    // Persist user message & resolve session
    const userId = Number(session.user?.id)
    let resolvedSessionId = sessionId

    if (!resolvedSessionId) {
      // For multi-repo, use the first repo as the session's repoId
      const [newSession] = await db
        .insert(chatSessions)
        .values({ userId, repoId: repoIds[0] })
        .returning({ id: chatSessions.id })
      resolvedSessionId = newSession.id
    }

    if (lastUserMessage) {
      await db.insert(messages).values({
        sessionId: resolvedSessionId,
        role: 'user',
        content: lastUserMessage.content,
      })
    }

    // Build tools and system prompt
    let tools
    let systemPrompt: string

    if (isMultiRepo) {
      const repoNameMap: Record<number, string> = {}
      for (const r of repoList) repoNameMap[r.id] = r.name
      tools = createMultiRepoTools(repoIds, repoNameMap)
      systemPrompt = buildMultiRepoSystemPrompt(repoList.map((r) => r.name)) + contextBlock
    } else {
      const repo = repoList[0]
      tools = createAgentTools(repo.id)
      systemPrompt = buildSystemPrompt(repo.name, repo.url) + contextBlock
    }

    const result = await streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: systemPrompt,
      messages: clientMessages,
      tools,
      maxSteps: 8,
      onFinish: async ({ text }) => {
        if (text) {
          await db.insert(messages).values({
            sessionId: resolvedSessionId,
            role: 'assistant',
            content: text,
          })
        }
      },
    })

    return result.toDataStreamResponse({
      headers: { 'X-Session-Id': String(resolvedSessionId) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Chat API error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
