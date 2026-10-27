import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesktopShell } from './DesktopShell'
import { resetSystem, useSystem } from '../../system/store'

beforeEach(() => {
  window.localStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
  render(<DesktopShell />)
})

afterEach(() => {
  cleanup()
})

const openControlCenter = () => fireEvent.click(screen.getByRole('button', { name: 'Control Center' }))

describe('ControlCenter', () => {
  it('opens from the status button and closes with Escape', () => {
    openControlCenter()
    expect(screen.getByRole('dialog', { name: 'Control Center' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Control Center' })).not.toBeInTheDocument()
    expect(useSystem.getState().overlay).toBeNull()
  })

  it('switches the appearance to dark', () => {
    openControlCenter()
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  })

  it('turns on reduce motion', () => {
    openControlCenter()
    fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }))
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true)
    expect(screen.getByRole('switch', { name: 'Reduce motion' })).toHaveAttribute('aria-checked', 'true')
  })

  it('selects a wallpaper from its swatch', () => {
    openControlCenter()
    fireEvent.click(screen.getByRole('button', { name: 'Graphite' }))
    expect(useSystem.getState().settings.wallpaperId).toBe('graphite')
    expect(screen.getByRole('button', { name: 'Graphite' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('takes keyboard focus on open and returns it to the status button on Escape', () => {
    const status = screen.getByRole('button', { name: 'Control Center' })
    status.focus()
    fireEvent.keyDown(status, { key: 'Enter' })
    fireEvent.click(status)
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(status).toHaveFocus()
  })

  it('makes only the selected appearance tabbable and moves the selection with arrow keys', () => {
    openControlCenter()
    const group = screen.getByRole('radiogroup', { name: 'Appearance' })
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(useSystem.getState().settings.appearance).toBe('dark')
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(useSystem.getState().settings.appearance).toBe('auto')

    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(useSystem.getState().settings.appearance).toBe('light')
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveFocus()
  })

  it('hides the full screen button when the browser cannot enter full screen', () => {
    openControlCenter()
    expect(screen.queryByRole('button', { name: /Full Screen/ })).not.toBeInTheDocument()
  })

  it('offers Enter Full Screen when the browser allows it', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true })
    try {
      act(() => {
        openControlCenter()
      })
      expect(screen.getByRole('button', { name: 'Enter Full Screen' })).toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(document, 'fullscreenEnabled')
    }
  })
})
