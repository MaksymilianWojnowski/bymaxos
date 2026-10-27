import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetSystem, useSystem } from '../../system/store'
import { BANNER_MS, Banners } from './Banners'

beforeEach(() => {
  vi.useFakeTimers()
  resetSystem()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Banners', () => {
  it('renders banners in a polite status region', () => {
    useSystem.getState().notify('Contacts', 'Email copied.')
    render(<Banners />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Contacts')
    expect(region).toHaveTextContent('Email copied.')
  })

  it('dismiss button removes the banner', () => {
    useSystem.getState().notify('Contacts')
    render(<Banners />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Contacts')).not.toBeInTheDocument()
    expect(useSystem.getState().banners).toEqual([])
  })

  it('auto-dismisses after BANNER_MS', () => {
    useSystem.getState().notify('Contacts')
    render(<Banners />)
    act(() => {
      vi.advanceTimersByTime(BANNER_MS)
    })
    expect(screen.queryByText('Contacts')).not.toBeInTheDocument()
  })
})
