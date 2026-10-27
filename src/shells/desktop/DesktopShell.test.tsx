import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetSystem, useSystem } from '../../system/store'
import { DesktopShell } from './DesktopShell'

beforeEach(() => {
  resetSystem()
  useSystem.getState().unlock()
})

afterEach(() => {
  cleanup()
})

describe('DesktopShell', () => {
  it('Skip to Resume is the first focusable element and opens Resume', async () => {
    render(<DesktopShell />)
    await userEvent.tab()
    const link = screen.getByRole('link', { name: 'Skip to Resume' })
    expect(link).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'resume')).toHaveLength(1)
  })
})
