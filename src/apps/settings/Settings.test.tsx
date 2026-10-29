import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { getContent } from '../../content'
import { resetSystem, useSystem } from '../../system/store'
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
})
