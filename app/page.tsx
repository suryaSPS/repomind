import { auth } from '@/lib/auth'
import MainApp from './MainApp'
import LandingPage from '@/components/LandingPage'

export default async function Home() {
  const session = await auth()
  if (!session) return <LandingPage />

  return (
    <MainApp key={session.user.id} userId={session.user.id} username={session.user?.name ?? 'user'} />
  )
}
