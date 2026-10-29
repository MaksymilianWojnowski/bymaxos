import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { getApp } from '../../apps/registry'
import { getContent } from '../../content'
import type { NotificationItem } from '../../content/types'
import { dispatch } from '../../system/commands'
import { MENU_BAR_H } from '../../system/layout'
import { useSystem } from '../../system/store'
import { KEYS, safeStorage } from '../../system/storage'
import { AppIcon } from '../../ui/AppIcon'

const NOTIFICATIONS = getContent().notifications

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  borderColor: 'var(--glass-border)',
}

// Text sits on the opaque window colour, not on the translucent glass, so its contrast is fixed (AA in both themes).
const SOLID = { background: 'var(--window-bg)', borderColor: 'var(--glass-border)' }

// Session storage is untrusted input: anything but a list of ids is treated as nothing dismissed.
function readDismissed(): string[] {
  const value = safeStorage.get<unknown>('session', KEYS.notifications, [])
  return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : []
}

function Card({ item, onOpen, onDismiss }: { item: NotificationItem; onOpen: (appId: string) => void; onDismiss: () => void }) {
  const app = item.appId !== undefined ? getApp(item.appId) : undefined
  const content = (
    <>
      {app && <AppIcon app={app} size={24} />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-text-1">{item.title}</span>
        <span className="text-[13px] text-text-2">{item.body}</span>
      </span>
    </>
  )

  return (
    <div className="relative rounded-[12px] border p-3" style={SOLID}>
      {app ? (
        <button type="button" onClick={() => onOpen(app.id)} className="flex w-full items-start gap-3 pr-6 text-left">
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-3 pr-6">{content}</div>
      )}
      <button
        type="button"
        aria-label={`Dismiss ${item.title}`}
        onClick={onDismiss}
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-text-2 hover:bg-black/10 dark:hover:bg-white/15"
      >
        <X aria-hidden="true" className="h-3 w-3" />
      </button>
    </div>
  )
}

// Dismissals live in session storage, so they last for this browser session only.
export function NotificationCenter() {
  const setOverlay = useSystem((s) => s.setOverlay)
  const ref = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)
  const visible = NOTIFICATIONS.filter((n) => !dismissed.includes(n.id))

  const saveDismissed = (ids: string[]) => {
    setDismissed(ids)
    safeStorage.set('session', KEYS.notifications, ids)
  }

  // Focus moves into the panel on open and returns to the opener on close, but only when focus was lost with the panel.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => {
      const active = document.activeElement
      if (opener?.isConnected && (active === null || active === document.body)) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      // The clock button toggles the panel itself; closing here too would reopen it.
      if (target instanceof Element && target.closest('[data-notification-toggle]')) return
      setOverlay(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [setOverlay])

  // Close first, as Spotlight does, so an overlay the app opens itself survives.
  const open = (appId: string) => {
    setOverlay(null)
    dispatch({ type: 'dock.activate', appId })
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label="Notification Center"
      className="fixed right-2 z-50 flex w-[356px] flex-col gap-2 overflow-y-auto rounded-[14px] border p-3 font-sans text-text-1 shadow-lg outline-none"
      style={{
        ...GLASS,
        top: MENU_BAR_H + 8,
        maxHeight: `calc(100vh - ${MENU_BAR_H + 16}px)`,
        animation: 'notification-slide 200ms ease-out',
      }}
    >
      <div className="flex items-center justify-between rounded-[8px] border px-2.5 py-1.5" style={SOLID}>
        <h2 className="text-[13px] font-semibold text-text-1">Notifications</h2>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={() => saveDismissed(NOTIFICATIONS.map((n) => n.id))}
            className="text-[13px] text-accent-link"
          >
            Clear All
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[12px] border px-3 py-6 text-center text-[13px] text-text-2" style={SOLID}>
          No Notifications
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li key={item.id}>
              <Card item={item} onOpen={open} onDismiss={() => saveDismissed([...dismissed, item.id])} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
