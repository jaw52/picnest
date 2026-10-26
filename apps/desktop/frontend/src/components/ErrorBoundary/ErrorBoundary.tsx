import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

import { i18n } from '~/i18n'

interface Props {
  children: ReactNode
  /**
   * Changing this remounts the boundary, giving the user a way to retry
   * (e.g. switching folder or filter) instead of being stuck on the error
   * screen forever.
   */
  resetKey?: unknown
}

interface State {
  error: Error | null
  resetKey: unknown
}

export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey }
  }

  state: State = { error: null, resetKey: this.props.resetKey }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Picnest crashed while rendering:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="wght-semibold text-subtitle text-red">{i18n.t('errorBoundary.title')}</p>
          <p className="max-w-md text-caption text-text-secondary">{this.state.error.message}</p>
          <p className="text-caption text-text-secondary">{i18n.t('errorBoundary.hint')}</p>
        </div>
      )
    }
    return this.props.children
  }
}
