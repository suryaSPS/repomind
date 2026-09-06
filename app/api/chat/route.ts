import { auth } from '@/lib/auth'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { db } from '@/lib/db'
import { messages, chatSessions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getAccessibleRepos, getOwnedChatSession } from '@/lib/authz'
import { buildAgentTurn, AGENT_MODEL, AGENT_MAX_STEPS } from '@/lib/agent/runtime'

export const maxDuration = 120

/**
 * How many past turns of a conversation to replay to the model. Caps prompt
 * growth (and cost) on long-running chats; the full transcript is still stored.
 */
const MAX_HISTORY_MESSAGES = 40

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = Number(session.user.id)
  const body = await req.json()
  const { messages: clientMessages, sessionId } = body

  // Support both single repoId and multi repoIds. De-duplicated and integer-only
  // so the access check below can compare counts safely.
  const rawRepoIds: unknown[] = Array.isArray(body.repoIds)
    ? body.repoIds
    : body.repoId != null
      ? [body.repoId]
      : []
  const repoIds: number[] = [...new Set(rawRepoIds.map(Number))].filter(Number.isInteger)

  if (repoIds.length === 0 || !clientMessages) {
    return new Response('Missing repoId(s) or messages', { status: 400 })
  }

  // Only repos this user may reach. Answering over someone else's repo would
  // stream their indexed source back to the caller, so a partial match is a 404.
  const repoList = await getAccessibleRepos(userId, repoIds)

  if (repoList.length !== repoIds.length) {
    return new Response('Repos not found', { status: 404 })
  }

  // Same for the session the transcript gets written to: an unchecked client
  // sessionId would append this exchange to another user's chat history.
  let resolvedSessionId: number | null = null
  if (sessionId != null) {
    const owned = await getOwnedChatSession(userId, Number(sessionId))
    if (!owned) return new Response('Session not found', { status: 404 })
    resolvedSessionId = owned.id
  }

  const notReady = repoList.find((r) => r.status !== 'ready')
  if (notReady) {
    return new Response(`Repo "${notReady.name}" not yet indexed`, { status: 400 })
  }

  try {
    const lastUserMessage = [...clientMessages]
      .reverse()
      .find((m: { role: string; content: string }) => m.role === 'user')

    // Persist user message & resolve session. Either the caller's own session
    // (validated above) or a fresh one owned by them — never an id we did not check.
    const activeSessionId =
      resolvedSessionId ??
      (
        await db
          .insert(chatSessions)
          // For multi-repo, use the first repo as the session's repoId
          .values({ userId, repoId: repoIds[0] })
          .returning({ id: chatSessions.id })
      )[0].id

    if (lastUserMessage) {
      await db.insert(messages).values({
        sessionId: activeSessionId,
        role: 'user',
        content: lastUserMessage.content,
      })
    }

    // Replay the conversation from the database rather than from the request.
    // The client only holds the turns of the chat it currently has open, so a
    // reopened session would otherwise reach the model with no history at all.
    // Reading it back here also means the transcript can't be rewritten by the
    // caller. Newest-first + reverse so the cap keeps the most recent turns.
    const stored = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.sessionId, activeSessionId))
      .orderBy(desc(messages.id))
      .limit(MAX_HISTORY_MESSAGES)

    const history = stored
      .reverse()
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    // Fall back to the request only if nothing was stored (e.g. no user turn).
    const modelMessages = history.length > 0 ? history : clientMessages

    // Prompt assembly (pre-retrieval, system prompt, tools) lives in
    // lib/agent/runtime so the offline eval measures this exact path.
    const { system, tools } = await buildAgentTurn(
      repoList.map((r) => ({ id: r.id, name: r.name, url: r.url })),
      lastUserMessage?.content ?? null
    )

    const result = await streamText({
      model: anthropic(AGENT_MODEL),
      system,
      messages: modelMessages,
      tools,
      maxSteps: AGENT_MAX_STEPS,
      onFinish: async ({ text }) => {
        if (text) {
          await db.insert(messages).values({
            sessionId: activeSessionId,
            role: 'assistant',
            content: text,
          })
        }
      },
    })

    return result.toDataStreamResponse({
      headers: { 'X-Session-Id': String(activeSessionId) },
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
