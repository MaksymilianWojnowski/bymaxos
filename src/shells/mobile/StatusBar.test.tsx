import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusBar } from './StatusBar'
import * as hooks from '../desktop/statusHooks'

vi.mock('../desktop/statusHooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../desktop/statusHooks')>()
  return { ...actual, useBattery: vi.fn(() => null), useNetwork: vi.fn(() => null) }
})

describe('StatusBar', () => {
  beforeEach(() => {
    vi.mocked(hooks.useBattery).mockReturnValue(null)
    vi.mocked(hooks.useNetwork).mockReturnValue(null)
  })

  afterEach(() => {
    cleanup()
  })

  it('shows battery percentage when the API reports it', () => {
    vi.mocked(hooks.useBattery).mockReturnValue({ level: 0.82, charging: false })
    render(<StatusBar />)
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Battery 82%' })).toBeInTheDocument()
  })

  it('shows no battery and no bars when neither API exists', () => {
    render(<StatusBar />)
    expect(screen.queryByRole('img', { name: /Battery/ })).toBeNull()
    expect(screen.queryByRole('img', { name: /Signal/ })).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
  })

  it('signal bars label', () => {
    vi.mocked(hooks.useNetwork).mockReturnValue({ bars: 3, type: '3g' })
    render(<StatusBar />)
    expect(screen.getByRole('img', { name: 'Signal: 3 of 4 bars' })).toBeInTheDocument()
  })
})
