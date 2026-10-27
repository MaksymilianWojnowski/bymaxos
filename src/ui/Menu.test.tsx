import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MenuBarMenus, MenuList } from './Menu'
import { ContextMenu } from './ContextMenu'
import { Popover } from './Popover'
import type { MenuDef, MenuItemDef } from '../apps/types'
import { registerGlobal, resetCommands } from '../system/commands'
import { resetSystem } from '../system/store'

const menus: MenuDef[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'Locked', command: { type: 'test.no' } },
      { label: 'Open', command: { type: 'test.ok' }, shortcut: '⌘O' },
      { separator: true },
      { label: 'Close', command: { type: 'test.ok' } },
    ],
  },
  { id: 'edit', label: 'Edit', items: [{ label: 'Undo', command: { type: 'test.ok' } }] },
]

const items: MenuItemDef[] = [
  { label: 'Open', command: { type: 'test.ok' } },
  { label: 'Locked', command: { type: 'test.no' } },
]

beforeEach(() => {
  resetSystem()
  resetCommands()
  registerGlobal('test.ok', () => {})
})

afterEach(() => {
  cleanup()
  resetCommands()
  vi.restoreAllMocks()
})

const bar = () => render(<MenuBarMenus menus={menus} />)
const title = (name: string) => screen.getByRole('menuitem', { name })

describe('MenuBarMenus', () => {
  it('opens a menu on click and closes it after an enabled item dispatches', () => {
    const handler = vi.fn()
    resetCommands()
    registerGlobal('test.ok', handler)
    bar()
    fireEvent.click(title('File'))
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /^Open/ }))
    expect(handler).toHaveBeenCalledWith({ type: 'test.ok' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders items whose command cannot dispatch as disabled and keeps the menu open', () => {
    bar()
    fireEvent.click(title('File'))
    const locked = screen.getByRole('menuitem', { name: 'Locked' })
    expect(locked).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(locked)
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument()
  })

  it('switches to another menu on hover while one is open', () => {
    bar()
    fireEvent.click(title('File'))
    fireEvent.pointerEnter(title('Edit'))
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(title('File')).toHaveAttribute('aria-expanded', 'false')
  })

  it('ArrowDown focuses the first enabled item and Escape closes back to the title', () => {
    bar()
    fireEvent.click(title('File'))
    fireEvent.keyDown(title('File'), { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /^Open/ })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /^Open/ }), { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(title('File')).toHaveFocus()
  })

  it('closes an open menu on Escape even when focus is outside the bar', () => {
    bar()
    fireEvent.click(title('File'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('names items by their label alone and exposes the shortcut as aria-keyshortcuts', () => {
    bar()
    fireEvent.click(title('File'))
    const open = screen.getByRole('menuitem', { name: 'Open' })
    expect(open).toHaveAttribute('aria-keyshortcuts', '⌘O')
  })

  it('closes on pointerdown outside the menu bar', () => {
    bar()
    fireEvent.click(title('File'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('MenuList', () => {
  it('marks checked items as menuitemcheckbox', () => {
    render(
      <MenuList items={[{ label: 'Wrap', checked: true }]} onClose={() => {}} labelledBy="x" />,
    )
    const item = screen.getByRole('menuitemcheckbox', { name: 'Wrap' })
    expect(item).toHaveAttribute('aria-checked', 'true')
  })
})

describe('ContextMenu', () => {
  it('stays inside the viewport on the right edge', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    render(<ContextMenu x={window.innerWidth - 10} y={50} items={items} onClose={() => {}} />)
    const wrapper = screen.getByRole('menu').parentElement as HTMLElement
    expect(wrapper.style.left).toBe(`${window.innerWidth - 204}px`)
  })

  it('focuses the first enabled item and closes on Escape', () => {
    const onClose = vi.fn()
    render(<ContextMenu x={10} y={10} items={items} onClose={onClose} />)
    expect(screen.getByRole('menuitem', { name: /^Open/ })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Popover', () => {
  it('ignores pointerdown on its anchor so the toggle button does not close it', () => {
    const onClose = vi.fn()
    const anchor = { top: 0, bottom: 24, left: 40, right: 80, width: 40, height: 24 } as DOMRect
    const button = document.createElement('button')
    document.body.appendChild(button)
    render(
      <Popover anchor={anchor} label="Status" onClose={onClose} anchorEl={button}>
        <p>body</p>
      </Popover>,
    )
    fireEvent.pointerDown(button)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    button.remove()
  })

  it('is a labelled dialog that closes on Escape', () => {
    const onClose = vi.fn()
    const anchor = { top: 0, bottom: 24, left: 40, right: 80, width: 40, height: 24 } as DOMRect
    render(
      <Popover anchor={anchor} label="Status" onClose={onClose}>
        <p>body</p>
      </Popover>,
    )
    expect(screen.getByRole('dialog', { name: 'Status' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
