import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MenuItemDef } from '../apps/types'
import { MenuList } from './Menu'

interface Props {
  x: number
  y: number
  items: MenuItemDef[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // The element focused when the menu mounts is the opener; the menu has not moved focus yet at this point.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  // Passive cleanup runs after the menu is removed, so focus that was in the menu has fallen to the body.
  useEffect(() => {
    return () => {
      const active = document.activeElement
      if (opener?.isConnected && (active === null || active === document.body)) opener.focus()
    }
  }, [opener])

  // Measured after mount so the right and bottom edges can be kept inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.min(x, window.innerWidth - width - 4)}px`
    el.style.top = `${Math.min(y, window.innerHeight - height - 4)}px`
    el.querySelector<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])')?.focus()
  }, [x, y, items])

  useEffect(() => {
    const onDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="fixed z-50" style={{ left: x, top: y }}>
      <MenuList items={items} onClose={onClose} />
    </div>,
    document.body,
  )
}
