import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Camera, ChevronUp, Flashlight, X } from 'lucide-react'
import { getApp } from '../../apps/registry'
import { getContent } from '../../content'
import type { NotificationItem } from '../../content/types'
import { readDismissed, saveDismissed } from '../../system/notifications'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'
import { useClock } from '../desktop/statusHooks'
import { Wallpaper } from '../desktop/Wallpaper'
import { StatusBar } from './StatusBar'
import { rubberBand, shouldUnlock } from './gestures'

const NOTIFICATIONS = getContent().notifications
const SWIPE_DISMISS = 80
const SETTLE_MS = 250

const pad = (n: number) => String(n).padStart(2, '0')
const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const CIRCLE =
  'flex h-[50px] w-[50px] items-center justify-center rounded-full bg-black/40 text-white active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'

// A card with an app is not activatable while locked; a left swipe past SWIPE_DISMISS dismisses it.
function Card({ item, onDismiss }: { item: NotificationItem; onDismiss: () => void }) {
  const app = item.appId !== undefined ? getApp(item.appId) : undefined
  const [dx, setDx] = useState(0)
  const startX = useRef<number | null>(null)

  const end = () => {
    if (startX.current === null) return
    startX.current = null
    if (dx < -SWIPE_DISMISS) onDismiss()
    else setDx(0)
  }

  return (
    <div
      data-card
      className="relative touch-pan-y rounded-[16px] border p-3"
      style={{ background: 'var(--window-bg)', borderColor: 'var(--glass-border)', transform: `translateX(${dx}px)` }}
      onPointerDown={(e) => {
        startX.current = e.clientX
      }}
      onPointerMove={(e) => {
        if (startX.current !== null) setDx(Math.min(0, e.clientX - startX.current))
      }}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={() => {
        startX.current = null
        setDx(0)
      }}
    >
      <div className="flex items-start gap-3 pr-10">
        {app && <AppIcon app={app} size={24} />}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[13px] font-semibold text-text-1">{item.title}</p>
          <p className="text-[13px] text-text-2">{item.body}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Dismiss ${item.title}`}
        onClick={onDismiss}
        className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full text-text-2 focus-visible:ring-2 focus-visible:ring-accent-link focus-visible:outline-none"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  )
}

export function LockScreen() {
  const unlock = useSystem((s) => s.unlock)
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const now = useClock()
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const gesture = useRef<{ startY: number; lastY: number; lastT: number; vy: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLButtonElement>(null)
  const layerRef = useRef<HTMLButtonElement>(null)
  const wasOn = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const visible = NOTIFICATIONS.filter((n) => !dismissed.includes(n.id))

  useEffect(() => {
    root.current?.focus()
    return () => window.clearTimeout(timer.current)
  }, [])

  // The flashlight layer takes focus when it opens, and focus goes back to its button when it closes.
  useEffect(() => {
    if (flashOn) layerRef.current?.focus()
    else if (wasOn.current) flashRef.current?.focus()
    wasOn.current = flashOn
  }, [flashOn])

  // A resize mid-drag makes the gesture's distances meaningless, so it is dropped.
  useEffect(() => {
    const onResize = () => {
      if (!gesture.current) return
      gesture.current = null
      setDragging(false)
      setDy(0)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dismiss = (id: string) => {
    const next = [...dismissed, id]
    setDismissed(next)
    saveDismissed(next)
  }

  const openCamera = () => {
    openMobileApp('photos')
    unlock()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) unlock()
  }

  // Buttons and cards keep their own pointer behaviour; the drag starts anywhere else.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (leaving || (e.target as Element).closest('button, [data-card]')) return
    gesture.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, vy: 0 }
    setDragging(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.vy = (g.lastY - e.clientY) / dt
    g.lastY = e.clientY
    g.lastT = e.timeStamp
    setDy(g.startY - e.clientY)
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = null
    setDragging(false)
    if (!g) return
    const total = g.startY - g.lastY
    if (!shouldUnlock(total, window.innerHeight, g.vy)) {
      setDy(0)
      return
    }
    setLeaving(true)
    if (document.documentElement.classList.contains('reduce-motion')) {
      unlock()
      return
    }
    timer.current = window.setTimeout(unlock, SETTLE_MS)
  }

  const onPointerCancel = () => {
    gesture.current = null
    setDragging(false)
    setDy(0)
  }

  const lift = dy > 0 ? `translateY(${-rubberBand(dy, window.innerHeight)}px)` : 'none'

  return (
    <div
      ref={root}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      className="relative h-full w-full touch-none overflow-hidden text-white outline-none"
    >
      <Wallpaper />
      <div aria-hidden="true" className="absolute inset-0 bg-[rgb(0_0_0/0.4)]" />

      <div
        data-lock-content
        aria-hidden={flashOn || undefined}
        inert={flashOn}
        className="absolute inset-0 flex flex-col"
        style={{
          transform: leaving ? 'translateY(-100%)' : lift,
          transition: dragging ? 'none' : 'transform 250ms ease-out',
        }}
      >
        <StatusBar onWallpaper />

        <div className="flex min-h-0 flex-1 flex-col [@media(max-height:500px)]:flex-row">
          <div className="flex flex-col items-center px-6 pt-6 text-center drop-shadow-md [@media(max-height:500px)]:w-1/2 [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:pt-0">
            <p className="text-[17px] font-semibold">{dateFormat.format(now)}</p>
            <p className="text-[84px] leading-none font-light tabular-nums [@media(max-height:500px)]:text-[64px]">
              {`${pad(now.getHours())}:${pad(now.getMinutes())}`}
            </p>
          </div>

          <ul className="mx-4 mt-6 flex flex-col gap-2 [@media(max-height:500px)]:mx-0 [@media(max-height:500px)]:mt-0 [@media(max-height:500px)]:flex-1 [@media(max-height:500px)]:overflow-y-auto [@media(max-height:500px)]:pr-4">
            {visible.map((item) => (
              <li key={item.id}>
                <Card item={item} onDismiss={() => dismiss(item.id)} />
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-3 px-8 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] drop-shadow-md">
          <div className="flex w-full items-center justify-between">
            <button
              ref={flashRef}
              type="button"
              aria-label="Flashlight"
              aria-pressed={flashOn}
              onClick={() => setFlashOn((on) => !on)}
              className={CIRCLE}
            >
              <Flashlight aria-hidden="true" className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Camera" onClick={openCamera} className={CIRCLE}>
              <Camera aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <ChevronUp aria-hidden="true" className="h-6 w-6 animate-bounce" />
          <p className="text-[15px] font-medium">Swipe up to unlock</p>
          <button
            type="button"
            onClick={unlock}
            className="min-h-11 min-w-11 px-4 text-[15px] font-medium underline focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            Unlock
          </button>
        </div>
      </div>

      {flashOn && (
        <button
          ref={layerRef}
          type="button"
          aria-label="Turn off flashlight"
          onClick={() => setFlashOn(false)}
          className="absolute inset-0 z-10 flex items-end justify-center bg-white pb-[calc(env(safe-area-inset-bottom)+3rem)] text-black focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black focus-visible:outline-none"
        >
          <span className="text-[15px] font-medium">Tap to turn off</span>
        </button>
      )}
    </div>
  )
}
