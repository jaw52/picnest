import type { ErrorInfo, ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Component } from 'react'
import { i18n } from '~/i18n'
import { text, weight } from '~/theme/text'
import { styles } from './style'

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
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey)
      return null
    return { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Picnest crashed while rendering:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div {...stylex.props(styles.root)}>
          <p {...stylex.props(text.subtitleCompact, weight.semibold, styles.title)}>
            {i18n.t('errorBoundary.title')}
          </p>
          <p {...stylex.props(text.caption, styles.muted, styles.message)}>
            {this.state.error.message}
          </p>
          <p {...stylex.props(text.caption, styles.muted)}>
            {i18n.t('errorBoundary.hint')}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
