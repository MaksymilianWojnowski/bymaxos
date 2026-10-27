import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { SHORTCUTS } from '../../system/shortcuts'
import { resetSystem, useSystem } from '../../system/store'
import { ShortcutsSheet } from './ShortcutsSheet'

beforeEach(() => {
  resetSystem()
  useSystem.setState({ keyboardLocked: true })
})

afterEach(() => {
  cleanup()
})

describe('ShortcutsSheet', () => {
  it('gives every shortcut a human label instead of the raw command type', () => {
    render(<ShortcutsSheet />)
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(SHORTCUTS.length)
    for (const row of rows) {
      const action = within(row).getAllByRole('cell')[1].textContent ?? ''
      expect(action).not.toBe('')
      expect(action).not.toContain('.')
    }
  })
})
