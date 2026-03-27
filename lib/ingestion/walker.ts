import fs from 'fs'
import path from 'path'

// Directories to always skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.turbo', '.cache', 'coverage', '__pycache__', '.venv',
  'venv', 'vendor', '.yarn', 'target', 'bin', 'obj',
])

// File extensions we care about
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php',
  '.vue', '.svelte', '.astro',
  '.md', '.mdx',
  '.json', '.yaml', '.yml', '.toml',
  '.sql', '.graphql', '.gql',
  '.sh', '.bash', '.zsh',
  '.html', '.css', '.scss', '.sass',
  '.env.example', '.gitignore', 'Dockerfile', 'Makefile',
])

const MAX_FILE_SIZE = 300 * 1024 // 300KB — skip massive files

export function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.mjs': 'javascript', '.cjs': 'javascript',
    '.py': 'python', '.rb': 'ruby',
    '.go': 'go', '.rs': 'rust',
    '.java': 'java', '.kt': 'kotlin',
    '.swift': 'swift', '.c': 'c',
    '.cpp': 'cpp', '.h': 'c',
    '.hpp': 'cpp', '.cs': 'csharp',
    '.php': 'php', '.vue': 'vue',
    '.svelte': 'svelte', '.md': 'markdown',
    '.mdx': 'markdown', '.json': 'json',
    '.yaml': 'yaml', '.yml': 'yaml',
    '.toml': 'toml', '.sql': 'sql',
    '.graphql': 'graphql', '.gql': 'graphql',
    '.sh': 'bash', '.bash': 'bash',
    '.zsh': 'bash', '.html': 'html',
    '.css': 'css', '.scss': 'scss',
  }
  return map[ext] ?? 'text'
}

export interface FileEntry {
  absolutePath: string
  relativePath: string
  language: string
  sizeBytes: number
}

export function walkRepo(repoPath: string): FileEntry[] {
  const results: FileEntry[] = []

  function walk(dir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        walk(path.join(dir, entry.name))
      } else if (entry.isFile()) {
        const fullPath = path.join(dir, entry.name)
        const ext = path.extname(entry.name).toLowerCase()

        // Check extension or exact filenames like Dockerfile
        const isCode =
          CODE_EXTENSIONS.has(ext) ||
          CODE_EXTENSIONS.has(entry.name)

        if (!isCode) continue

        let stat: fs.Stats
        try {
          stat = fs.statSync(fullPath)
        } catch {
          continue
        }

        if (stat.size > MAX_FILE_SIZE) continue
        if (stat.size === 0) continue

        results.push({
          absolutePath: fullPath,
          relativePath: path.relative(repoPath, fullPath),
          language: getLanguage(fullPath),
          sizeBytes: stat.size,
        })
      }
    }
  }

  walk(repoPath)
  return results
}
