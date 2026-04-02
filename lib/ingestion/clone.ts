import simpleGit from 'simple-git'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

// On Vercel, process.cwd() is read-only — use /tmp instead
const REPOS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'repomind-repos')
  : path.join(process.cwd(), 'data', 'repos')

export function getRepoHash(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12)
}

export function getRepoPath(url: string): string {
  return path.join(REPOS_DIR, getRepoHash(url))
}

export async function cloneRepo(
  url: string,
  onProgress?: (stage: string, pct: number) => void
): Promise<string> {
  const repoPath = getRepoPath(url)

  // Already cloned — pull latest
  if (fs.existsSync(repoPath)) {
    onProgress?.('Pulling latest changes...', 5)
    const git = simpleGit(repoPath)
    await git.pull()
    onProgress?.('Up to date', 10)
    return repoPath
  }

  fs.mkdirSync(repoPath, { recursive: true })
  onProgress?.('Cloning repository...', 5)

  const git = simpleGit()
  await git.clone(url, repoPath, ['--depth', '500'])

  onProgress?.('Clone complete', 15)
  return repoPath
}

export async function getGitLog(repoPath: string): Promise<
  {
    hash: string
    message: string
    author: string
    date: Date
    filesChanged: string[]
  }[]
> {
  const git = simpleGit(repoPath)

  const log = await git.log([
    '--all',
    '--max-count=300',
    '--format=%H|||%an|||%ad|||%s',
    '--date=iso',
  ])

  const commits = []
  for (const entry of log.all) {
    const [hash, author, dateStr, ...messageParts] = (
      entry.hash +
      '|||' +
      entry.author_name +
      '|||' +
      entry.date +
      '|||' +
      entry.message
    )
      .split('|||')
    const message = messageParts.join(' ').trim()

    // Get files changed for this commit
    let filesChanged: string[] = []
    try {
      const diff = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '-r',
        '--name-only',
        hash,
      ])
      filesChanged = diff
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(0, 20)
    } catch {
      // Some commits (initial) may not have a diff
    }

    commits.push({
      hash,
      message,
      author,
      date: new Date(dateStr),
      filesChanged,
    })
  }

  return commits
}

export async function getCommitDiff(repoPath: string, hash: string): Promise<string> {
  try {
    const git = simpleGit(repoPath)
    const diff = await git.raw(['show', '--stat', hash])
    return diff.slice(0, 4000)
  } catch {
    return ''
  }
}
