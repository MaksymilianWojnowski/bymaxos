import { useState, type MouseEvent, type ReactNode } from 'react'
import type { MenuItemDef } from '../apps/types'
import { ContextMenu } from './ContextMenu'

interface OpenMenu {
  x: number
  y: number
  items: MenuItemDef[]
}

// Render `element` once in the tree; `open` is called from the element's onContextMenu.
export function useContextMenu(): {
  open: (e: MouseEvent, items: MenuItemDef[]) => void
  element: ReactNode
} {
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  return {
    open: (e, items) => {
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY, items })
    },
    element: menu ? (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        items={menu.items}
        onClose={() => setMenu(null)}
      />
    ) : null,
  }
}
