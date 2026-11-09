import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppDefinition } from '../apps/types'
import { AppIcon } from './AppIcon'

const shell = vi.hoisted(() => ({ value: 'mobile' as 'desktop' | 'mobile' }))
const complete = vi.hoisted(() => ({ value: true }))

vi.mock('../system/shell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../system/shell')>()),
  useShell: () => shell.value,
}))

vi.mock('../apps/darkIcons', () => ({
  darkIcons: { notes: '/dark/notes.png' },
  darkIconsComplete: () => complete.value,
}))

const notes = {
  id: 'notes',
  name: 'Notes',
  icon: { image: '/light/notes.png', darkKey: 'notes' },
} as AppDefinition

const brand = {
  id: 'linkedin',
  name: 'LinkedIn',
  icon: { glyph: () => <svg data-testid="glyph" />, background: '#0a66c2', color: '#ffffff' },
} as unknown as AppDefinition

const setTheme = (theme: 'light' | 'dark') => {
  document.documentElement.dataset.theme = theme
}

beforeEach(() => {
  shell.value = 'mobile'
  complete.value = true
  setTheme('dark')
})

afterEach(() => {
  setTheme('light')
})

describe('AppIcon dark artwork', () => {
  it('phone dark mode uses the dark artwork when the set is complete', () => {
    const { container } = render(<AppIcon app={notes} size={60} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/dark/notes.png')
  })

  it('an incomplete dark set keeps the light artwork', () => {
    complete.value = false
    const { container } = render(<AppIcon app={notes} size={60} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/light/notes.png')
  })

  it('desktop dark mode keeps the light artwork', () => {
    shell.value = 'desktop'
    const { container } = render(<AppIcon app={notes} size={60} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/light/notes.png')
  })

  it('a dark brand glyph sits on a dark tile in its brand colour', () => {
    const { getByTestId } = render(<AppIcon app={brand} size={60} />)
    const tile = getByTestId('glyph').parentElement!
    expect(tile).toHaveStyle({ background: '#1c1c1e', color: '#0a66c2' })
  })

  it('a theme switch while mounted swaps to the dark artwork', async () => {
    setTheme('light')
    const { container } = render(<AppIcon app={notes} size={60} />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/light/notes.png')
    await act(async () => setTheme('dark'))
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/dark/notes.png')
  })
})
