import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ContextMenu } from './ContextMenu'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Opener
      </button>
      {open && (
        <ContextMenu x={10} y={10} items={[{ label: 'Open' }]} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

afterEach(() => {
  cleanup()
})

describe('ContextMenu focus', () => {
  it('focuses the first item and returns focus to the opener on Escape', () => {
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
