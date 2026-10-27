import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { dockItems, getApp } from '../../apps/registry'
import type { AppDefinition, MenuItemDef } from '../../apps/types'
import { registerGlobal } from '../../system/commands'
import { useSystem } from '../../system/store'
import type { AppId } from '../../system/types'
import { topWindowOfApp } from '../../system/wm'
import { AppIcon } from '../../ui/AppIcon'
import { useContextMenu } from '../../ui/useContextMenu'
import { dockClickAction, magnifyScale } from './dockLogic'
import { dockIconRects } from './dockIconRects'

const ITEMS = dockItems()

// Restores every minimized window of the app, then focuses the topmost one.
function showAll(appId: AppId): void {
  for (const w of useSystem.getState().wm.windows) {
    if (w.appId === appId && w.mode === 'minimized') useSystem.getState().restore(w.id)
  }
  const top = topWindowOfApp(useSystem.getState().wm, appId)
  if (top) useSystem.getState().focus(top.id)
}

export function Dock() {
  const windows = useSystem((s) => s.wm.windows)
  const size = useSystem((s) => s.settings.dockSize)
  const magnify = useSystem((s) => s.settings.dockMagnification && !s.settings.reduceMotion)
  const menu = useContextMenu()
  const buttons = useRef(new Map<AppId, HTMLButtonElement>())
  const [scales, setScales] = useState<Record<AppId, number>>({})

  // Context-menu commands that have no store action of their own.
  useEffect(() => {
    const disposeShowAll = registerGlobal(
      'dock.showAll',
      (cmd) => showAll(String(cmd.appId)),
      (cmd) => useSystem.getState().wm.windows.some((w) => w.appId === cmd.appId),
    )
    const disposeOpenLink = registerGlobal('dock.openLink', (cmd) => {
      const url = getApp(String(cmd.appId))?.external
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    })
    return () => {
      disposeShowAll()
      disposeOpenLink()
    }
  }, [])

  // Icon rects feed the minimize animation; they move with the dock size and the viewport.
  useLayoutEffect(() => {
    const measure = () => {
      for (const app of ITEMS) {
        const el = buttons.current.get(app.id)
        if (el) dockIconRects.set(app.id, el.getBoundingClientRect())
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      for (const app of ITEMS) dockIconRects.delete(app.id)
    }
  }, [size])

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!magnify) return
    const next: Record<AppId, number> = {}
    for (const app of ITEMS) {
      const el = buttons.current.get(app.id)
      if (!el) continue
      const r = el.getBoundingClientRect()
      next[app.id] = magnifyScale(Math.abs(e.clientX - (r.left + r.width / 2)))
    }
    setScales(next)
  }

  const activate = (app: AppDefinition) => {
    const store = useSystem.getState()
    const action = dockClickAction(store.wm, app)
    switch (action.type) {
      case 'external':
        window.open(action.url, '_blank', 'noopener,noreferrer')
        break
      case 'alias':
        store.openApp(action.appId, action.props)
        break
      case 'focus':
        store.focus(action.id)
        break
      case 'restore':
        store.restore(action.id)
        break
      case 'open':
        store.openApp(app.id)
        break
    }
  }

  const onContextMenu = (e: MouseEvent, app: AppDefinition) => {
    const items: MenuItemDef[] = app.external
      ? [{ label: 'Open', command: { type: 'dock.openLink', appId: app.id } }]
      : app.alias
        ? [
            {
              label: 'Open',
              command: { type: 'app.open', appId: app.alias.appId, props: app.alias.props },
            },
          ]
        : [
            { label: 'Open', command: { type: 'app.open', appId: app.id } },
            { label: 'Show All Windows', command: { type: 'dock.showAll', appId: app.id } },
            { separator: true },
            { label: 'Quit', command: { type: 'app.quit', appId: app.id } },
          ]
    menu.open(e, items)
  }

  return (
    <>
      <div
        aria-label="Dock"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setScales({})}
        className="fixed bottom-2 left-1/2 z-50 flex -translate-x-1/2 items-end gap-[6px] rounded-[18px] border px-2 pt-2 pb-1.5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderColor: 'var(--glass-border)',
        }}
      >
        {ITEMS.map((app, i) => {
          const prev = ITEMS[i - 1]
          const external = Boolean(app.external)
          const running = windows.some((w) => w.appId === app.id)
          return (
            <Fragment key={app.id}>
              {prev && prev.dock.group !== app.dock.group && (
                <div aria-hidden="true" className="mb-1 h-[60%] w-px self-center bg-[var(--glass-border)]" />
              )}
              <div className="group relative flex">
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(app.id, el)
                    else buttons.current.delete(app.id)
                  }}
                  type="button"
                  aria-label={external ? `${app.name} (opens in new tab)` : app.name}
                  onClick={() => activate(app)}
                  onContextMenu={(e) => onContextMenu(e, app)}
                  className="peer relative flex rounded-[22.5%] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{
                    width: size,
                    height: size,
                    transform: `scale(${scales[app.id] ?? 1})`,
                    transformOrigin: 'bottom',
                    transition: magnify ? 'transform 120ms ease-out' : undefined,
                  }}
                >
                  <AppIcon app={app} size={size} />
                  {external && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-black shadow"
                    >
                      ↗
                    </span>
                  )}
                  {running && (
                    <span
                      data-testid={`running-dot-${app.id}`}
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-text-2"
                    />
                  )}
                </button>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-[6px] px-2 py-0.5 text-[12px] whitespace-nowrap text-text-1 opacity-0 transition-opacity group-hover:opacity-100 peer-focus-visible:opacity-100"
                  style={{ background: 'var(--menu-bg)' }}
                >
                  {app.name}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
      {menu.element}
    </>
  )
}
