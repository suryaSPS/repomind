import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { chatSessions, messages } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const sessionId = Number(id)
  const userId = Number(session.user?.id)

  // Verify ownership
  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1)

  if (!chatSession || chatSession.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))

  return NextResponse.json({ messages: msgs })
}
