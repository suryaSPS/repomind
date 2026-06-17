import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { deleteRepoChunks } from '@/lib/vector/search'
import fs from 'fs'
import { getAccessibleRepo, parsePositiveInt } from '@/lib/repo-access'
import { repos } from '@/lib/db/schema'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const userId = parsePositiveInt(session.user?.id)
  const repoId = parsePositiveInt(id)

  if (!userId || !repoId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const repo = await getAccessibleRepo(userId, repoId)
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
