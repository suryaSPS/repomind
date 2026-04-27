'use client'

interface Message {
  role: string
  content: string
}

interface ExportChatButtonProps {
  messages: Message[]
  repoName: string
}

export default function ExportChatButton({ messages, repoName }: ExportChatButtonProps) {
  if (messages.length === 0) return null

  function handleExport() {
    const date = new Date().toISOString().split('T')[0]
    const lines = [
      `# RepoMind Chat — ${repoName}`,
      `_Exported ${date}_`,
      '',
      '---',
      '',
    ]

    for (const msg of messages) {
      if (msg.role === 'user') {
        lines.push(`## 👤 You\n\n${msg.content}\n`)
      } else {
        lines.push(`## 🔍 RepoMind\n\n${msg.content}\n`)
      }
      lines.push('---', '')
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repomind-${repoName}-${date}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      title="Export chat as Markdown"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors"
      style={{
        background: 'transparent',
        borderColor: 'var(--border)',
        color: 'var(--muted-foreground)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--brand)'
        e.currentTarget.style.color = 'var(--brand)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--muted-foreground)'
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export .md
    </button>
  )
}
