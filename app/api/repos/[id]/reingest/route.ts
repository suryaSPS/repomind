import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ingestRepo } from '@/lib/ingestion'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const repoId = Number(id)

  const [repo] = await db.select().from(repos).where(eq(repos.id, repoId)).limit(1)
  if (!repo) return new Response('Repo not found', { status: 404 })

  // Reset status to pending before re-ingesting
  await db
    .update(repos)
    .set({ status: 'pending', errorMessage: null, updatedAt: new Date() })
    .where(eq(repos.id, repoId))

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))

      ingestRepo(repoId, repo.url, (p) => send(p))
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
