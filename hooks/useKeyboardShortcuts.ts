import { useEffect } from 'react'

interface ShortcutOptions {
  onFocusInput?: () => void   // Cmd+K
  onNewChat?: () => void      // Cmd+N (or Cmd+Shift+N)
  onEscape?: () => void       // Escape — clear input
}

export function useKeyboardShortcuts({
  onFocusInput,
  onNewChat,
  onEscape,
}: ShortcutOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac')
      const modifier = isMac ? e.metaKey : e.ctrlKey

      // Cmd+K — focus the chat input
      if (modifier && e.key === 'k') {
        e.preventDefault()
        onFocusInput?.()
        return
      }

      // Cmd+Shift+N — new chat
      if (modifier && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        onNewChat?.()
        return
      }

      // Escape — clear / blur input
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFocusInput, onNewChat, onEscape])
}
