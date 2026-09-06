'use client'

import { useState, useSyncExternalStore } from 'react'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener('repomind:quick-start', callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('repomind:quick-start', callback)
  }
}

export function useQuickStart(userId: string, hasIndexedRepos: boolean) {
  const key = `repomind:quick-start:v1:${userId}`
  const [dismissed, setDismissed] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const active = useSyncExternalStore(subscribe, () => {
    try {
      return localStorage.getItem(key) !== 'done'
    } catch {
      return true
    }
  }, () => false)

  function finish() {
    setDismissed(true)
    setReplaying(false)
    try {
      localStorage.setItem(key, 'done')
      window.dispatchEvent(new Event('repomind:quick-start'))
    } catch { /* The guide can still be dismissed when storage is unavailable. */ }
  }

  function restart() {
    setDismissed(false)
    setReplaying(true)
    try {
      localStorage.removeItem(key)
      window.dispatchEvent(new Event('repomind:quick-start'))
    } catch { /* Storage is optional for the walkthrough. */ }
  }

  return { active: !dismissed && (replaying || (active && !hasIndexedRepos)), finish, restart }
}
