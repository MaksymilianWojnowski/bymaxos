import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Popover } from './Popover'

function Harness() {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  return (
    <>
      <button ref={setAnchor} type="button" onClick={() => setOpen(true)}>
        Toggle
      </button>
      {open && anchor && (
        <Popover
          anchor={anchor.getBoundingClientRect()}
          label="Panel"
          anchorEl={anchor}
          onClose={() => setOpen(false)}
        >
          <button type="button">Inside</button>
        </Popover>
      )}
    </>
  )
}

afterEach(() => {
  cleanup()
})

describe('Popover focus', () => {
  it('moves focus into the panel on open and back to the toggle on Escape', () => {
    render(<Harness />)
    const toggle = screen.getByRole('button', { name: 'Toggle' })
    toggle.focus()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Panel' })).not.toBeInTheDocument()
    expect(toggle).toHaveFocus()
  })
})
