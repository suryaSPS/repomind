'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: string }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-full p-8">
          <div
            className="text-center max-w-md p-6 rounded-2xl border"
            style={{ background: 'var(--card)', borderColor: '#7f1d1d' }}
          >
            <p className="text-2xl mb-3">⚠️</p>
            <h3 className="text-base font-semibold text-white mb-2">Something went wrong</h3>
            <p className="text-sm text-red-400 mb-4 font-mono">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="text-sm px-4 py-2 rounded-lg text-white transition-colors"
              style={{ background: '#7f1d1d' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#991b1b')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#7f1d1d')}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
