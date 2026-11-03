import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { NavStack } from './NavStack'

const WIDTH = 390

afterEach(cleanup)

// Two rows open the detail; a rerender with fewer rows lets a test remove the opener.
function Harness({ rows, detail = <p>Body</p> }: { rows: string[]; detail?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <NavStack
      title="Notes"
      list={rows.map((r) => (
        <button key={r} type="button" onClick={() => setOpen(true)}>
          {r}
        </button>
      ))}
      open={open}
      detailTitle="Detail"
      onBack={() => setOpen(false)}
      detail={detail}
    />
  )
}

// Pointer events carry their coordinates and timestamp; jsdom has no real timing.
const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', node: Element, x: number, y: number, t: number) => {
  const event = createEvent[type](node, { clientX: x, clientY: y, pointerId: 1 })
  Object.defineProperty(event, 'timeStamp', { value: t })
  fireEvent(node, event)
}

const root = () => document.querySelector('.relative.h-full.overflow-hidden') as HTMLElement
const detailPane = () => screen.getByText('Body').closest('[data-detail-pane]') as HTMLElement

function stubWidth() {
  Object.defineProperty(root(), 'offsetWidth', { configurable: true, value: WIDTH })
}

describe('NavStack', () => {
  it('shows the list with its title, and hides the detail from assistive tech while closed', () => {
    render(<Harness rows={['First']} />)
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('open shows detail title and Back; the list is inert', () => {
    render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={() => {}} detail={<p>Body</p>} />,
    )
    expect(screen.getByRole('heading', { name: 'Detail' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Notes', hidden: true }).closest('[inert]')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Detail' }).closest('[inert]')).toBeNull()
  })

  it('Back calls onBack and returns focus to the row that opened the detail', () => {
    render(<Harness rows={['A', 'B']} />)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'B' }))
  })

  it('falls back to the first list control when that row is gone', () => {
    const { rerender } = render(<Harness rows={['A', 'B']} />)
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    rerender(<Harness rows={['A']} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'A' }))
  })

  it('focuses the detail heading when opened, and not on first mount', () => {
    const props = { title: 'Notes', list: <p>Row</p>, detailTitle: 'Detail', onBack: () => {}, detail: <p>Body</p> }
    const { rerender } = render(<NavStack {...props} open />)
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Detail' }))
    rerender(<NavStack {...props} open={false} />)
    rerender(<NavStack {...props} open />)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Detail' }))
  })

  it('a child focusing its own field on open keeps that focus', () => {
    function Field({ open }: { open: boolean }) {
      const ref = useRef<HTMLInputElement>(null)
      useEffect(() => {
        if (open) ref.current?.focus()
      }, [open])
      return <input aria-label="Title field" ref={ref} />
    }
    const props = { title: 'Notes', list: <p>Row</p>, detailTitle: 'Detail', onBack: () => {} }
    const { rerender } = render(<NavStack {...props} open={false} detail={<Field open={false} />} />)
    rerender(<NavStack {...props} open detail={<Field open />} />)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title field' }))
  })

  it('Escape inside the detail goes back', () => {
    const onBack = vi.fn()
    render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={onBack} detail={<p>Body</p>} />,
    )
    fireEvent.keyDown(screen.getByText('Body'), { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('Escape from a portalled sheet does not', () => {
    const onBack = vi.fn()
    const sheet = createPortal(<button type="button">Sheet action</button>, document.body)
    render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={onBack} detail={sheet} />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'Sheet action' }), { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()
  })

  it('a left-edge pointer drag goes back; one from mid-screen does not', () => {
    const onBack = vi.fn()
    const { unmount } = render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={onBack} detail={<p>Body</p>} />,
    )
    stubWidth()
    pointer('pointerDown', screen.getByText('Body'), 10, 100, 0)
    pointer('pointerMove', screen.getByText('Body'), 200, 100, 50)
    pointer('pointerUp', screen.getByText('Body'), 200, 100, 50)
    expect(onBack).toHaveBeenCalledTimes(1)
    unmount()

    const midScreen = vi.fn()
    render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={midScreen} detail={<p>Body</p>} />,
    )
    stubWidth()
    pointer('pointerDown', screen.getByText('Body'), 200, 100, 0)
    pointer('pointerMove', screen.getByText('Body'), 390, 100, 50)
    pointer('pointerUp', screen.getByText('Body'), 390, 100, 50)
    expect(midScreen).not.toHaveBeenCalled()
  })

  it('a cancelled pointer clears the inline transform', () => {
    render(
      <NavStack title="Notes" list={<p>Row</p>} open detailTitle="Detail" onBack={() => {}} detail={<p>Body</p>} />,
    )
    stubWidth()
    pointer('pointerDown', screen.getByText('Body'), 10, 100, 0)
    pointer('pointerMove', screen.getByText('Body'), 100, 100, 16)
    expect(detailPane().style.transform).toBe('translateX(90px)')
    pointer('pointerCancel', screen.getByText('Body'), 100, 100, 16)
    expect(detailPane().style.transform).toBe('')
  })
})
