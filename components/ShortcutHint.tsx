'use client'

import { useEffect, useState } from 'react'

export default function ShortcutHint() {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'))
  }, [])

  const mod = isMac ? '⌘' : 'Ctrl'

  return (
    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
      <kbd
        className="px-1 py-0.5 rounded text-xs font-mono"
        style={{ background: '#1e1e2e', border: '1px solid #2d2d44' }}
      >
        {mod}K
      </kbd>{' '}
      focus ·{' '}
      <kbd
        className="px-1 py-0.5 rounded text-xs font-mono"
        style={{ background: '#1e1e2e', border: '1px solid #2d2d44' }}
      >
        {mod}⇧N
      </kbd>{' '}
      new chat
    </span>
  )
}
