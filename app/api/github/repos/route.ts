import { auth } from '@/lib/auth'

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
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const token = (session as any).githubAccessToken as string | undefined

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'No GitHub token. Sign in with GitHub to use this feature.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Fetch repos the user has access to (owned + collaborator + org member)
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
        return new Response(
          JSON.stringify({ error: `GitHub API error: ${res.status}` }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const batch: GitHubRepo[] = await res.json()
      if (batch.length === 0) break
      allRepos.push(...batch)

      // Cap at 300 repos to avoid massive lists
      if (allRepos.length >= 300) break
      page++
    }

    return new Response(
      JSON.stringify({ repos: allRepos }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('GitHub repos fetch error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
