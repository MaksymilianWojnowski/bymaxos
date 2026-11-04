import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { resetSystem, useSystem } from '../../system/store'
import { mockPhone } from '../../test/mockPhone'
import SettingsApp from './Settings'

const wallpapers = getContent().site.wallpapers
const settings = () => useSystem.getState().settings

const renderApp = (props?: Record<string, unknown>) => render(<SettingsApp windowId="w1" props={props} />)
const sectionButton = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  window.localStorage.clear()
  resetSystem()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SettingsApp', () => {
  it('lists the sections in the sidebar with Appearance selected first and no Language section', () => {
    renderApp()
    const nav = screen.getByRole('navigation', { name: 'Settings sections' })
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Appearance',
      'Wallpaper',
      'Accessibility',
      'Dock',
    ])
    expect(sectionButton('Appearance')).toHaveAttribute('aria-current', 'page')
    expect(sectionButton('Wallpaper')).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('button', { name: /language/i })).toBeNull()
  })

  it('opens the Dock section for the dock deep link', () => {
    renderApp({ item: 'dock' })
    expect(sectionButton('Dock')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Dock' })).toBeInTheDocument()
  })

  it('sets the appearance from the Light, Dark and Auto radios', () => {
    renderApp()
    const group = screen.getByRole('radiogroup', { name: 'Appearance' })
    fireEvent.click(within(group).getByRole('radio', { name: 'Dark' }))
    expect(settings().appearance).toBe('dark')
    fireEvent.click(within(group).getByRole('radio', { name: 'Light' }))
    expect(settings().appearance).toBe('light')
  })

  it('sets the accent from a radio per accent colour', () => {
    renderApp()
    const group = screen.getByRole('radiogroup', { name: 'Accent colour' })
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Blue',
      'Purple',
      'Pink',
      'Red',
      'Orange',
      'Yellow',
      'Green',
      'Graphite',
    ])
    fireEvent.click(within(group).getByRole('radio', { name: 'Pink' }))
    expect(settings().accent).toBe('pink')
  })

  it('sets the wallpaper from a radio per site wallpaper', () => {
    renderApp()
    fireEvent.click(sectionButton('Wallpaper'))
    const group = screen.getByRole('radiogroup', { name: 'Wallpaper' })
    expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(
      wallpapers.map((w) => w.name),
    )
    fireEvent.click(within(group).getByRole('radio', { name: 'Graphite' }))
    expect(settings().wallpaperId).toBe('graphite')
  })

  it('toggles reduce motion and reduce transparency from the Accessibility switches', () => {
    renderApp()
    fireEvent.click(sectionButton('Accessibility'))
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce transparency' }))
    expect(settings()).toMatchObject({ reduceMotion: true, reduceTransparency: true })
  })

  it('gives the first wallpaper radio the tab stop when the stored id matches no wallpaper', () => {
    useSystem.setState({ settings: { ...settings(), wallpaperId: 'no-such-wallpaper' } })
    renderApp({ item: 'wallpaper' })
    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toHaveAttribute('tabindex', '0')
    expect(radios.slice(1).every((r) => r.getAttribute('tabindex') === '-1')).toBe(true)
  })

  it('sets the dock size from the slider and toggles magnification from the Dock switch', () => {
    renderApp({ item: 'dock' })
    const slider = screen.getByLabelText('Size')
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('min', '40')
    expect(slider).toHaveAttribute('max', '72')
    expect(slider).toHaveAttribute('step', '4')
    fireEvent.change(slider, { target: { value: '64' } })
    expect(settings().dockSize).toBe(64)

    const magnification = screen.getByRole('switch', { name: 'Magnification' })
    fireEvent.click(magnification)
    expect(settings().dockMagnification).toBe(false)
  })

  it('a new item switches section while mounted', () => {
    const view = renderApp()
    expect(sectionButton('Appearance')).toHaveAttribute('aria-current', 'page')

    view.rerender(<SettingsApp windowId="w1" props={{ item: 'dock' }} />)
    expect(sectionButton('Dock')).toHaveAttribute('aria-current', 'page')
  })
})

describe('Settings on a phone', () => {
  const list = () => screen.getByRole('navigation', { name: 'Settings sections' })

  it('phone: lists Appearance, Wallpaper and Accessibility, and no Dock', () => {
    mockPhone()
    renderApp()
    expect(within(list()).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Appearance',
      'Wallpaper',
      'Accessibility',
    ])
  })

  it('phone: a section opens and Back returns', async () => {
    mockPhone()
    const user = userEvent.setup()
    renderApp()
    await user.click(within(list()).getByRole('button', { name: 'Wallpaper' }))
    expect(screen.getByRole('radiogroup', { name: 'Wallpaper' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('radiogroup', { name: 'Wallpaper' })).not.toBeInTheDocument()
    expect(list()).toBeInTheDocument()
  })

  it('phone: item=dock stays on the list', () => {
    mockPhone()
    renderApp({ item: 'dock' })
    expect(list()).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('phone: opening with item=wallpaper starts in that section', () => {
    mockPhone()
    renderApp({ item: 'wallpaper' })
    expect(screen.getByRole('heading', { level: 2, name: 'Wallpaper' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Wallpaper' })).toBeInTheDocument()
  })
})
