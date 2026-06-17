import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chatSessions, repos, type ChatSession, type Repo } from '@/lib/db/schema'

function canAccessRepo(userId: number) {
  return or(eq(repos.userId, userId), isNull(repos.userId))
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function parseRepoIds(input: unknown): number[] | null {
  const rawIds = Array.isArray(input) ? input : input === undefined || input === null ? [] : [input]
  const ids = rawIds.map(parsePositiveInt)

  if (ids.some((id): id is null => id === null)) {
    return null
  }

  return [...new Set(ids as number[])]
}

export async function getAccessibleRepo(
  userId: number,
  repoId: number
): Promise<Repo | null> {
  const [repo] = await db
    .select()
    .from(repos)
    .where(and(eq(repos.id, repoId), canAccessRepo(userId)))
    .limit(1)

  return repo ?? null
}

export async function getAccessibleRepos(
  userId: number,
  repoIds: number[]
): Promise<Repo[]> {
  if (repoIds.length === 0) return []

  const rows = await db
    .select()
    .from(repos)
    .where(and(inArray(repos.id, repoIds), canAccessRepo(userId)))

  const byId = new Map(rows.map((repo) => [repo.id, repo]))
  return repoIds
    .map((id) => byId.get(id))
    .filter((repo): repo is Repo => Boolean(repo))
}

export async function getOwnedChatSession(
  userId: number,
  sessionId: number
): Promise<ChatSession | null> {
  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1)

  return chatSession ?? null
}
