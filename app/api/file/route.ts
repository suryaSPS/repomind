import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getFileFromDB } from '@/lib/vector/search'
import { getAccessibleRepo, parsePositiveInt } from '@/lib/repo-access'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const userId = parsePositiveInt(session.user?.id)
  const repoId = parsePositiveInt(searchParams.get('repoId'))
  const filePath = searchParams.get('filePath')

  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!repoId || !filePath) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const repo = await getAccessibleRepo(userId, repoId)
  if (!repo) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const file = await getFileFromDB(repoId, filePath)
  if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  return NextResponse.json({
    content: file.content.slice(0, 50_000),
    filePath,
    language: file.language,
  })
}
