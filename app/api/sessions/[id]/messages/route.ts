import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getOwnedChatSession } from '@/lib/authz'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const sessionId = Number(id)

  const chatSession = await getOwnedChatSession(Number(session.user.id), sessionId)
  if (!chatSession) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))

  return NextResponse.json({ messages: msgs })
}
