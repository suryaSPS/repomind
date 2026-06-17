import { auth, getGitHubToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { ingestRepo } from '@/lib/ingestion'
import { repos } from '@/lib/db/schema'
import { getAccessibleRepo, parsePositiveInt } from '@/lib/repo-access'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const userId = parsePositiveInt(session.user?.id)
  const repoId = parsePositiveInt(id)

  if (!userId || !repoId) return new Response('Repo not found', { status: 404 })

  const repo = await getAccessibleRepo(userId, repoId)
  if (!repo) return new Response('Repo not found', { status: 404 })
  const userGitHubToken = await getGitHubToken(userId)

  // Reset status to pending before re-ingesting
  await db
    .update(repos)
    .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
    .where(eq(repos.id, repoId))

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))

      ingestRepo(repoId, repo.url, (p) => send(p), userGitHubToken)
        .then(() => send({ stage: 'done', percent: 100, repoId }))
        .catch((err) => send({ stage: 'error', percent: 0, error: err.message }))
        .finally(() => controller.close())
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
