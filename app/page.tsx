import { auth } from '@/lib/auth'
import MainApp from './MainApp'
import LandingPage from '@/components/LandingPage'

export default async function Home() {
  const session = await auth()
  if (!session) return <LandingPage />

  return (
    <MainApp username={session.user?.name ?? 'user'} />
  )
}
