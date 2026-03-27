import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { ingestRepo } from '@/lib/ingestion'

function parseGithubUrl(url: string): { owner: string; name: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('github.com')) return null
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/')
    if (parts.length < 2) return null
    return { owner: parts[0], name: parts[1] }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return new Response('Missing url', { status: 400 })
  }

  const parsed = parseGithubUrl(url.trim())
  if (!parsed) {
    return new Response('Invalid GitHub URL', { status: 400 })
  }

  // Check if already ingested and ready
  const existing = await db
    .select()
    .from(repos)
    .where(eq(repos.url, url.trim()))
    .limit(1)

  let repoId: number

  if (existing.length > 0 && existing[0].status === 'ready') {
    // Already done — return immediately
    return new Response(
      createStream(async (send) => {
        send({ stage: 'Already indexed!', percent: 100 })
        send({ stage: 'done', percent: 100, repoId: existing[0].id })
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      }
    )
  }

  if (existing.length > 0) {
    repoId = existing[0].id
  } else {
    const [inserted] = await db
      .insert(repos)
      .values({
        url: url.trim(),
        name: parsed.name,
        owner: parsed.owner,
        status: 'pending',
      })
      .returning({ id: repos.id })
    repoId = inserted.id
  }

  // Stream progress via SSE
  const stream = createStream(async (send) => {
    try {
      await ingestRepo(repoId, url.trim(), (progress) => {
        send(progress)
      })
      send({ stage: 'done', percent: 100, repoId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      send({ stage: 'error', percent: 0, error: message })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function createStream(
  fn: (send: (data: object) => void) => Promise<void>
): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }
      fn(send).finally(() => controller.close())
    },
  })
}
