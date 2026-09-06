import { auth } from '@/lib/auth'
import MainApp from './MainApp'
import LandingPage from '@/components/LandingPage'
import { db } from '@/lib/db'
import { repos } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export default async function Home() {
  const session = await auth()
  if (!session) return <LandingPage />

  const [indexedRepo] = await db.select({ id: repos.id }).from(repos)
    .where(and(eq(repos.userId, Number(session.user.id)), eq(repos.status, 'ready')))
    .limit(1)

  return (
    <MainApp key={session.user.id} userId={session.user.id} username={session.user?.name ?? 'user'} hasIndexedRepos={Boolean(indexedRepo)} />
  )
}
