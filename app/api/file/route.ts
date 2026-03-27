import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const repoId = Number(searchParams.get('repoId'))
  const filePath = searchParams.get('filePath')

  if (!repoId || !filePath) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId)).limit(1)
  if (!repo?.clonedPath) return NextResponse.json({ error: 'Repo not found' }, { status: 404 })

  const fullPath = path.join(repo.clonedPath, filePath)
  if (!fullPath.startsWith(repo.clonedPath)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let content: string
  try {
    content = fs.readFileSync(fullPath, 'utf-8')
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  return NextResponse.json({ content: content.slice(0, 50000), filePath })
}
