import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import { extract } from 'tar'

// On Vercel, process.cwd() is read-only — use /tmp instead
const REPOS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'repomind-repos')
  : path.join(process.cwd(), 'data', 'repos')

/**
 * Parse a GitHub URL into owner/repo.
 * Supports: https://github.com/owner/repo[.git][/...]
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const cleaned = url.replace(/\.git$/, '').replace(/\/+$/, '')
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) throw new Error(`Not a valid GitHub URL: ${url}`)
  return { owner: match[1], repo: match[2] }
}

export function getRepoHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12)
}

export function getRepoPath(url: string): string {
  return path.join(REPOS_DIR, getRepoHash(url))
}

/**
 * Download and extract a GitHub repo tarball to disk.
 * Works on Vercel (no git binary needed).
 */
export async function cloneRepo(
  url: string,
  onProgress?: (stage: string, pct: number) => void
): Promise<string> {
  const repoPath = getRepoPath(url)
  const { owner, repo } = parseGitHubUrl(url)

  // Already extracted — skip
  if (fs.existsSync(repoPath) && fs.readdirSync(repoPath).length > 0) {
    onProgress?.('Using cached copy…', 5)
    onProgress?.('Up to date', 10)
    return repoPath
  }

  fs.mkdirSync(repoPath, { recursive: true })
  onProgress?.('Downloading repository…', 5)

  // Download tarball via GitHub API (public repos, no auth needed)
  const tarballUrl = `https://api.github.com/repos/${owner}/${repo}/tarball`
  const headers: Record<string, string> = {
    'User-Agent': 'RepoMind',
    Accept: 'application/vnd.github+json',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const res = await fetch(tarballUrl, { headers })
  if (!res.ok) {
    throw new Error(`GitHub tarball download failed: ${res.status} ${res.statusText}`)
  }

  onProgress?.('Extracting files…', 10)

  // GitHub tarballs contain a single top-level directory like "owner-repo-sha/"
  // We extract and then move contents up to repoPath
  const tmpExtract = repoPath + '_extract'
  fs.mkdirSync(tmpExtract, { recursive: true })

  // Stream → gunzip → untar
  const body = res.body
  if (!body) throw new Error('Empty response body from GitHub')

  // Convert web ReadableStream to Node.js stream
  const { Readable } = await import('stream')
  const nodeStream = Readable.fromWeb(body as import('stream/web').ReadableStream)

  await pipeline(nodeStream, createGunzip(), extract({ cwd: tmpExtract }))

  // Move contents from the single top-level dir into repoPath
  const extracted = fs.readdirSync(tmpExtract)
  const topDir = extracted.find((d) =>
    fs.statSync(path.join(tmpExtract, d)).isDirectory()
  )

  if (topDir) {
    const srcDir = path.join(tmpExtract, topDir)
    for (const entry of fs.readdirSync(srcDir)) {
      fs.renameSync(path.join(srcDir, entry), path.join(repoPath, entry))
    }
  }

  // Cleanup temp extraction dir
  fs.rmSync(tmpExtract, { recursive: true, force: true })

  onProgress?.('Clone complete', 15)
  return repoPath
}

/**
 * Fetch commit history via GitHub REST API.
 */
export async function getGitLog(repoPath: string, url?: string): Promise<
  {
    hash: string
    message: string
    author: string
    date: Date
    filesChanged: string[]
  }[]
> {
  // We need the URL to call GitHub API. Try to infer from the repoPath if not provided.
  if (!url) {
    throw new Error('GitHub URL is required for getGitLog')
  }

  const { owner, repo } = parseGitHubUrl(url)
  const headers: Record<string, string> = {
    'User-Agent': 'RepoMind',
    Accept: 'application/vnd.github+json',
  }
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const commits: {
    hash: string
    message: string
    author: string
    date: Date
    filesChanged: string[]
  }[] = []

  // Fetch up to 300 commits (3 pages of 100)
  for (let page = 1; page <= 3; page++) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${page}`
    const res = await fetch(apiUrl, { headers })

    if (!res.ok) {
      if (page === 1) {
        throw new Error(`GitHub commits API failed: ${res.status} ${res.statusText}`)
      }
      break // Later pages may 404 if there are fewer commits
    }

    const data = (await res.json()) as Array<{
      sha: string
      commit: {
        message: string
        author: { name: string; date: string }
      }
      files?: Array<{ filename: string }>
    }>

    if (data.length === 0) break

    for (const item of data) {
      commits.push({
        hash: item.sha,
        message: item.commit.message.split('\n')[0], // First line only
        author: item.commit.author.name,
        date: new Date(item.commit.author.date),
        filesChanged: (item.files ?? []).map((f) => f.filename).slice(0, 20),
      })
    }

    if (data.length < 100) break // Last page
  }

  return commits
}

/**
 * Fetch a single commit's diff summary via GitHub REST API.
 */
export async function getCommitDiff(repoPath: string, hash: string, url?: string): Promise<string> {
  if (!url) return ''

  try {
    const { owner, repo } = parseGitHubUrl(url)
    const headers: Record<string, string> = {
      'User-Agent': 'RepoMind',
      Accept: 'application/vnd.github+json',
    }
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${hash}`
    const res = await fetch(apiUrl, { headers })
    if (!res.ok) return ''

    const data = (await res.json()) as {
      sha: string
      commit: { message: string; author: { name: string } }
      stats?: { total: number; additions: number; deletions: number }
      files?: Array<{
        filename: string
        status: string
        additions: number
        deletions: number
        patch?: string
      }>
    }

    // Build a summary similar to `git show --stat`
    const lines: string[] = []
    lines.push(`commit ${data.sha}`)
    lines.push(`Author: ${data.commit.author.name}`)
    lines.push(`\n    ${data.commit.message}\n`)

    if (data.files) {
      for (const f of data.files) {
        lines.push(` ${f.filename} | +${f.additions} -${f.deletions}`)
      }
    }

    if (data.stats) {
      lines.push(
        `\n ${data.files?.length ?? 0} files changed, ${data.stats.additions} insertions(+), ${data.stats.deletions} deletions(-)`
      )
    }

    return lines.join('\n').slice(0, 4000)
  } catch {
    return ''
  }
}
