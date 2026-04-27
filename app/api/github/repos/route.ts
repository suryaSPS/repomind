import { auth, getGitHubToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  html_url: string
  language: string | null
  stargazers_count: number
  updated_at: string
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Token is fetched from the DB — never from the client-visible session
  const token = await getGitHubToken(Number(session.user.id))

  if (!token) {
    return Response.json(
      { error: 'No GitHub token found. Sign in with GitHub OAuth to use this feature.' },
      { status: 403 }
    )
  }

  try {
    const allRepos: GitHubRepo[] = []
    let page = 1

    while (true) {
      const res = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      )

      if (!res.ok) {
        const err = await res.text()
        console.error('GitHub API error:', res.status, err)
        return Response.json(
          { error: `GitHub API returned ${res.status}` },
          { status: 502 }
        )
      }

      const batch: GitHubRepo[] = await res.json()
      if (batch.length === 0) break
      allRepos.push(...batch)
      if (allRepos.length >= 300) break // cap at 300
      page++
    }

    return Response.json({ repos: allRepos })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('GitHub repos fetch error:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
