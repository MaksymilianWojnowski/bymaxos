import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Sheet } from './Sheet'

afterEach(() => {
  cleanup()
})

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button">Opener</button>
      {open && (
        <Sheet
          title="Test sheet"
          onClose={() => {
            setOpen(false)
            onClose()
          }}
        >
          <button type="button">First</button>
          <button type="button">Second</button>
        </Sheet>
      )}
    </>
  )
}

describe('Sheet', () => {
  it('wraps Tab from the last control to the first', () => {
    render(<Harness onClose={() => {}} />)
    const done = screen.getByRole('button', { name: 'Done' })
    done.focus()
    fireEvent.keyDown(done, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Harness onClose={() => {}} />)
    const first = screen.getByRole('button', { name: 'First' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus()
  })

  it('returns focus to the element that was focused before it opened', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    // Harness opens the sheet on mount; the opener is focused before the sheet mounts only in a real flow.
    cleanup()
    render(
      <>
        <button type="button">Opener</button>
        <OpenerSheet />
      </>,
    )
    screen.getByRole('button', { name: 'Opener' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'Test sheet' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Test sheet' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus()
  })
})

function OpenerSheet() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Sheet title="Test sheet" onClose={() => setOpen(false)}>
          <p>body</p>
        </Sheet>
      )}
    </>
  )
}
