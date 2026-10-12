import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '../ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

describe('errorBoundary', () => {
  it('renders a fallback with the error message instead of unmounting to a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText('kaboom')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('recovers once resetKey changes', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('kaboom')).toBeInTheDocument()

    rerender(
      <ErrorBoundary resetKey="b">
        <div>recovered</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('recovered')).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
