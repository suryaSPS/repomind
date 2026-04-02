import { auth } from '@/lib/auth'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { db } from '@/lib/db'
import { repos, messages, chatSessions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createAgentTools } from '@/lib/agent/tools'
import { buildSystemPrompt } from '@/lib/agent/prompts'
import { searchCodeChunks, searchCommitChunks } from '@/lib/vector/search'
import { embedBatch } from '@/lib/ingestion/embedder'

export const maxDuration = 120

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { repoId, messages: clientMessages, sessionId } = await req.json()

  if (!repoId || !clientMessages) {
    return new Response('Missing repoId or messages', { status: 400 })
  }

  // Fetch repo info
  const [repo] = await db
    .select()
    .from(repos)
    .where(eq(repos.id, Number(repoId)))
    .limit(1)

  if (!repo) return new Response('Repo not found', { status: 404 })
  if (repo.status !== 'ready') {
    return new Response('Repo not yet indexed', { status: 400 })
  }

  // Get the latest user message for initial context retrieval
  const lastUserMessage = [...clientMessages]
    .reverse()
    .find((m: { role: string; content: string }) => m.role === 'user')

  // Pre-fetch top context chunks to include in the system prompt
  let contextBlock = ''
  if (lastUserMessage?.content) {
    const [queryEmbedding] = await embedBatch([lastUserMessage.content])
    const codeResults = await searchCodeChunks(repo.id, queryEmbedding, 5)
    const commitResults = await searchCommitChunks(repo.id, queryEmbedding, 3)

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

  // Persist user message & resolve session
  const userId = Number(session.user?.id)
  let resolvedSessionId = sessionId

  if (!resolvedSessionId) {
    const [newSession] = await db
      .insert(chatSessions)
      .values({ userId, repoId: repo.id })
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

  const tools = createAgentTools(repo.id)

  const result = await streamText({
    model: anthropic('claude-3-7-sonnet-20250219'),
    system: buildSystemPrompt(repo.name, repo.url) + contextBlock,
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
}
