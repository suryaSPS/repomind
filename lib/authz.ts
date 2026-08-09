import { db } from '@/lib/db'
import { repos, chatSessions } from '@/lib/db/schema'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'

/**
 * Per-user access rules for repos and chat sessions.
 *
 * Every handler that takes a repoId / sessionId from the request must run these
 * before touching the row — an authenticated session alone says who the caller
 * is, not what they are allowed to reach.
 *
 * Repo rule mirrors what GET /api/repos lists: rows the user owns, plus legacy
 * rows written before repos had an owner (user_id IS NULL), which stay shared so
 * existing installs keep working.
 */

/** Repos out of `repoIds` that this user may read or act on. */
export async function getAccessibleRepos(userId: number, repoIds: number[]) {
  if (repoIds.length === 0) return []

  return db
    .select()
    .from(repos)
    .where(
      and(
        inArray(repos.id, repoIds),
        or(eq(repos.userId, userId), isNull(repos.userId))
      )
    )
}

/** Single repo this user may read or act on, or `null`. */
export async function getAccessibleRepo(userId: number, repoId: number) {
  if (!Number.isInteger(repoId)) return null
  const [repo] = await getAccessibleRepos(userId, [repoId])
  return repo ?? null
}

/** Chat session owned by this user, or `null`. Sessions are never shared. */
export async function getOwnedChatSession(userId: number, sessionId: number) {
  if (!Number.isInteger(sessionId)) return null

  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1)

  return chatSession ?? null
}
