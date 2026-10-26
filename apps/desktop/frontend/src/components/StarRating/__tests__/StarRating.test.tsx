import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { StarRating } from '../StarRating'

describe('starRating', () => {
  it("clicking a star reports that star's value", () => {
    const onChange = vi.fn()
    render(<StarRating rating={0} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('3 星'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('clicking the currently-set star clears the rating', () => {
    const onChange = vi.fn()
    render(<StarRating rating={3} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('3 星'))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('has a button that clears the rating', () => {
    const onChange = vi.fn()
    render(<StarRating rating={4} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('未评分'))
    expect(onChange).toHaveBeenCalledWith(0)
  })
})
