import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const allRepos = await db
    .select({
      id: repos.id,
      url: repos.url,
      name: repos.name,
      owner: repos.owner,
      status: repos.status,
      fileCount: repos.fileCount,
      commitCount: repos.commitCount,
      createdAt: repos.createdAt,
    })
    .from(repos)
    .orderBy(desc(repos.createdAt))

  return NextResponse.json({ repos: allRepos })
}
