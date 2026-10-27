import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetSystem, useSystem } from '../../system/store'
import { Dock } from './Dock'
import { Spotlight } from './Spotlight'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false, overlay: 'spotlight' })
  // Dock registers the global dock.activate command that Spotlight dispatches.
  render(
    <>
      <Dock />
      <Spotlight />
    </>,
  )
})

afterEach(() => {
  cleanup()
})

const search = () => screen.getByRole('combobox', { name: 'Spotlight Search' })

describe('Spotlight', () => {
  it('focuses the search field on open', () => {
    expect(search()).toHaveFocus()
  })

  it('returns focus to the element that had it when it unmounts', () => {
    cleanup()
    render(<button type="button">Opener</button>)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    const { unmount } = render(<Spotlight />)
    expect(search()).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
  })

  it('lists results; ArrowDown and ArrowUp move the active option with wrap; Enter runs it and closes', () => {
    fireEvent.change(search(), { target: { value: 'resume' } })
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Resume')
    expect(search()).toHaveAttribute('aria-activedescendant', options[0].id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(search(), { key: 'ArrowUp' })
    expect(search()).toHaveAttribute('aria-activedescendant', options[options.length - 1].id)

    fireEvent.keyDown(search(), { key: 'ArrowDown' })
    expect(search()).toHaveAttribute('aria-activedescendant', options[0].id)

    fireEvent.keyDown(search(), { key: 'Enter' })
    expect(useSystem.getState().wm.windows.some((w) => w.appId === 'resume')).toBe(true)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('clicking a result runs it', () => {
    fireEvent.change(search(), { target: { value: 'mail' } })
    fireEvent.click(screen.getByRole('option', { name: 'Mail' }))
    expect(useSystem.getState().wm.windows.some((w) => w.appId === 'mail')).toBe(true)
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('clicking outside the panel closes Spotlight', () => {
    fireEvent.mouseDown(screen.getByTestId('spotlight-backdrop'))
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('shows No Results for a query with no match', () => {
    fireEvent.change(search(), { target: { value: 'zzqxnomatch' } })
    expect(screen.getByText('No Results')).toBeInTheDocument()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
