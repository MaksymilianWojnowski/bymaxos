import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DesktopShell } from './DesktopShell'
import { resetSystem, useSystem } from '../../system/store'

beforeEach(() => {
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
