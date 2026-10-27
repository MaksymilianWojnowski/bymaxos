import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { MenuDef, MenuItemDef } from '../apps/types'
import { canDispatch, dispatch } from '../system/commands'
import { useSystem } from '../system/store'
import { ariaKeyshortcuts } from '../system/shortcuts'

type Item = Extract<MenuItemDef, { label: string }>

// Matches menuitem and menuitemcheckbox rows, and not the menu-bar titles outside them.
const ENABLED_ITEM = '[role^="menuitem"]:not([aria-disabled="true"])'

const isEnabled = (item: Item): boolean =>
  !item.disabled && (!item.command || canDispatch(item.command))

const glass = { background: 'var(--menu-bg)', backdropFilter: 'blur(var(--glass-blur))' }

interface MenuListProps {
  items: MenuItemDef[]
  onClose: () => void
  labelledBy?: string
}

export function MenuList({ items, onClose, labelledBy }: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const menu = ref.current
    if (!menu) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const enabled = Array.from(menu.querySelectorAll<HTMLElement>(ENABLED_ITEM))
      if (enabled.length === 0) return
      const i = enabled.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown' ? (i + 1) % enabled.length : i <= 0 ? enabled.length - 1 : i - 1
      enabled[next].focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement
      if (!target.matches(ENABLED_ITEM)) return
      e.preventDefault()
      target.click()
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="min-w-[180px] rounded-mac-menu p-1 font-sans text-[13px] text-text-1 shadow-lg"
      style={glass}
    >
      {items.map((item, i) =>
        'separator' in item ? (
          <div key={i} role="separator" className="my-1 h-px bg-black/10 dark:bg-white/15" />
        ) : (
          <MenuRow key={i} item={item} onClose={onClose} />
        ),
      )}
    </div>
  )
}

function MenuRow({ item, onClose }: { item: Item; onClose: () => void }) {
  const enabled = isEnabled(item)
  const checkable = item.checked !== undefined
  return (
    <div
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? item.checked : undefined}
      aria-disabled={enabled ? undefined : 'true'}
      aria-keyshortcuts={item.shortcut && ariaKeyshortcuts(item.shortcut)}
      tabIndex={-1}
      onClick={() => {
        if (!enabled) return
        // Close first: the item unmounts, and a sheet the command opens must find the menu title focused as its opener.
        onClose()
        if (item.command) dispatch(item.command)
      }}
      onPointerEnter={(e) => {
        if (enabled) e.currentTarget.focus()
      }}
      // Disabled rows never take focus, so they never show the accent highlight.
      onMouseDown={(e) => {
        if (!enabled) e.preventDefault()
      }}
      className="group flex h-[22px] cursor-default items-center gap-2 rounded-[4px] px-3 outline-none focus:bg-accent focus:text-white aria-disabled:opacity-40"
    >
      <span aria-hidden="true" className="w-3 text-center">
        {item.checked ? '✓' : ''}
      </span>
      <span className="flex-1 whitespace-nowrap">{item.label}</span>
      {item.shortcut && (
        <span aria-hidden="true" className="ml-6 text-text-2 group-focus:text-white">
          {item.shortcut}
        </span>
      )}
    </div>
  )
}

interface MenuBarMenusProps {
  menus: MenuDef[]
  leading?: ReactNode
}

export function MenuBarMenus({ menus, leading }: MenuBarMenusProps) {
  const openMenuId = useSystem((s) => s.openMenuId)
  const setOpenMenu = useSystem((s) => s.setOpenMenu)
  const barRef = useRef<HTMLDivElement>(null)
  const titles = useRef(new Map<string, HTMLButtonElement>())

  // Clicks inside the bar are handled by its own buttons and items.
  useEffect(() => {
    if (openMenuId === null) return
    const onDown = (e: Event) => {
      if (!barRef.current?.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [openMenuId, setOpenMenu])

  // Safari does not focus a clicked button, so Escape may arrive with focus outside the bar.
  useEffect(() => {
    if (openMenuId === null) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openMenuId, setOpenMenu])

  const closeTo = (id: string) => {
    setOpenMenu(null)
    titles.current.get(id)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && openMenuId !== null) {
      e.preventDefault()
      closeTo(openMenuId)
      return
    }
    if (e.key === 'ArrowDown' && openMenuId !== null && titles.current.get(openMenuId) === e.target) {
      e.preventDefault()
      const first = titles.current.get(openMenuId)?.parentElement
      first?.querySelector<HTMLElement>(`[role="menu"] ${ENABLED_ITEM}`)?.focus()
      return
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const currentId =
      openMenuId ?? menus.find((m) => titles.current.get(m.id) === e.target)?.id ?? null
    const index = menus.findIndex((m) => m.id === currentId)
    if (index < 0) return
    e.preventDefault()
    const step = e.key === 'ArrowRight' ? 1 : -1
    const next = menus[(index + step + menus.length) % menus.length]
    if (openMenuId !== null) setOpenMenu(next.id)
    titles.current.get(next.id)?.focus()
  }

  return (
    <div
      ref={barRef}
      role="menubar"
      aria-label="Menu bar"
      onKeyDown={onKeyDown}
      className="flex h-[var(--mb-h)] items-center gap-1 font-sans text-[13px] text-text-1"
    >
      {leading}
      {menus.map((menu) => {
        const open = menu.id === openMenuId
        return (
          <div key={menu.id} className="relative">
            <button
              ref={(el) => {
                if (el) titles.current.set(menu.id, el)
                else titles.current.delete(menu.id)
              }}
              id={`menu-title-${menu.id}`}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpenMenu(open ? null : menu.id)}
              onPointerEnter={(e) => {
                if (openMenuId === null || open) return
                setOpenMenu(menu.id)
                if (barRef.current?.contains(document.activeElement)) e.currentTarget.focus()
              }}
              className={`h-[var(--mb-h)] rounded-[4px] px-2 ${open ? 'bg-accent text-white' : ''}`}
            >
              {menu.label}
            </button>
            {open && (
              <div className="absolute top-full left-0 z-50 pt-0.5">
                <MenuList
                  items={menu.items}
                  labelledBy={`menu-title-${menu.id}`}
                  onClose={() => closeTo(menu.id)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
