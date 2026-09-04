import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { deleteRepoChunks } from '@/lib/vector/search'
import { getAccessibleRepo } from '@/lib/authz'
import fs from 'fs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const repoId = Number(id)

  // Deleting a repo cascades to its chat_sessions and messages, so an unchecked
  // id here lets any signed-in user wipe another user's chat history.
  const repo = await getAccessibleRepo(Number(session.user.id), repoId)
  if (!repo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Wipe all vectors for this repo
  await deleteRepoChunks(repoId)

  // Delete repo row (cascades to chat_sessions + messages)
  await db.delete(repos).where(eq(repos.id, repoId))

  // Remove cloned directory from disk
  if (repo.clonedPath) {
    try { fs.rmSync(repo.clonedPath, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  return NextResponse.json({ success: true })
}
