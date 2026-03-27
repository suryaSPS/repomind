import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MainApp from './MainApp'

export default async function Home() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <MainApp username={session.user?.name ?? 'user'} />
  )
}
