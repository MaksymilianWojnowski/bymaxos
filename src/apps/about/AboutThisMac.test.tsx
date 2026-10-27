import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AboutThisMacApp from './AboutThisMac'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AboutThisMac', () => {
  it('shows the product name, version and the profile name as builder', () => {
    render(<AboutThisMacApp />)
    expect(screen.getByRole('heading', { name: 'bymaxOS' })).toBeInTheDocument()
    expect(screen.getByText(`Version ${__APP_VERSION__}`)).toBeInTheDocument()
    expect(screen.getByText('Maksymilian Wojnowski')).toBeInTheDocument()
  })

  it('opens the GitHub profile from More Info in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<AboutThisMacApp />)
    fireEvent.click(screen.getByRole('button', { name: 'More Info…' }))
    expect(open).toHaveBeenCalledWith(
      'https://github.com/MaksymilianWojnowski',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
