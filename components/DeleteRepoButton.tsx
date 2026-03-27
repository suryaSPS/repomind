'use client'

import { useState } from 'react'

interface DeleteRepoButtonProps {
  repoId: number
  repoName: string
  onDeleted: () => void
}

export default function DeleteRepoButton({ repoId, repoName, onDeleted }: DeleteRepoButtonProps) {
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/repos/${repoId}`, { method: 'DELETE' })
    setLoading(false)
    onDeleted()
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1 mt-1 ml-5">
        <span className="text-xs text-red-400">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-2 py-0.5 rounded text-red-400 border border-red-900 hover:bg-red-950 transition-colors"
        >
          {loading ? '…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs px-2 py-0.5 rounded transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs ml-5 mt-0.5 transition-colors"
      style={{ color: '#374151' }}
      title={`Delete ${repoName}`}
      onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
      onMouseLeave={(e) => (e.currentTarget.style.color = '#374151')}
    >
      Delete repo
    </button>
  )
}
