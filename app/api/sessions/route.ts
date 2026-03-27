import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatSessions, messages, repos } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = Number(session.user?.id)

  const sessions = await db
    .select({
      id: chatSessions.id,
      repoId: chatSessions.repoId,
      repoName: repos.name,
      repoOwner: repos.owner,
      createdAt: chatSessions.createdAt,
    })
    .from(chatSessions)
    .innerJoin(repos, eq(chatSessions.repoId, repos.id))
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.createdAt))
    .limit(50)

  return NextResponse.json({ sessions })
}
