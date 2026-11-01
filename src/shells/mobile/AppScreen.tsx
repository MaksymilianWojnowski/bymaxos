import { Suspense, useEffect, useReducer, useRef, type PointerEvent } from 'react'
import { X } from 'lucide-react'
import { getApp } from '../../apps/registry'
import type { AppDefinition } from '../../apps/types'
import { useSystem } from '../../system/store'
import type { WindowState } from '../../system/types'
import { componentFor, resetComponent } from '../appComponents'
import { AppErrorBoundary } from '../desktop/AppErrorBoundary'
import { StatusBar } from './StatusBar'

const HOME_SWIPE = 60
// Pointer travel beyond this is a drag, so the click that follows it does not go home.
const DRAG_SLOP = 10

// Mounts the app inside its error boundary; a crash resets the cached component and re-renders.
function mountApp(app: AppDefinition, win: WindowState, rerender: () => void) {
  const App = componentFor(app)
  if (!App) return null
  return (
    <div
      tabIndex={0}
      className="min-h-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-link"
    >
      <AppErrorBoundary
        appName={app.name}
        onReset={() => {
          resetComponent(app.id)
          rerender()
        }}
      >
        <Suspense fallback={null}>
          <App windowId={win.id} props={win.props} />
        </Suspense>
      </AppErrorBoundary>
    </div>
  )
}

// The focused window's app, full screen; a sheet presentation (Mail) floats over the home screen instead.
export function AppScreen() {
  const win = useSystem((s) => s.wm.windows.find((w) => w.id === s.wm.focusedId))
  const goHome = useSystem((s) => s.goHome)
  const winId = win?.id
  const rootRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const homeStart = useRef<number | null>(null)
  const suppressClick = useRef(false)
  // A reset drops the cached lazy component; this re-render makes the screen pick up the fresh one.
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  // Each opened app takes focus, so keyboard and screen reader users land in it.
  useEffect(() => {
    if (!winId) return
    regionRef.current?.focus({ preventScroll: true })
    const el = rootRef.current
    if (document.documentElement.classList.contains('reduce-motion') || !el || typeof el.animate !== 'function') return
    const anim = el.animate(
      [
        { transform: 'scale(0.9)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 220, easing: 'ease-out' },
    )
    return () => anim.cancel()
  }, [winId])

  const app = win && getApp(win.appId)
  if (!win || !app) return null
  const sheet = app.mobile?.presentation === 'sheet'

  const region = (
    <div ref={regionRef} tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
      {mountApp(app, win, rerender)}
    </div>
  )

  if (sheet) {
    return (
      <div ref={rootRef} className="absolute inset-0 flex flex-col">
        <div aria-hidden="true" className="absolute inset-0 bg-black/40" />
        <div className="relative bg-window">
          <StatusBar />
        </div>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={app.name}
          className="relative flex min-h-0 flex-1 flex-col rounded-t-xl bg-window pb-[env(safe-area-inset-bottom)]"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-text-2" />
          <header className="flex items-center justify-between px-4">
            <h2 className="text-[17px] font-semibold text-text-1">{app.name}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={goHome}
              className="flex h-11 w-11 items-center justify-center rounded-full text-text-1 focus-visible:ring-2 focus-visible:ring-accent-link"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>
          {region}
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="absolute inset-0 flex flex-col bg-window">
      <StatusBar />
      {region}
      <div className="flex flex-col items-center pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          aria-label="Home"
          onPointerDown={(e: PointerEvent) => {
            homeStart.current = e.clientY
            suppressClick.current = false
          }}
          onPointerUp={(e: PointerEvent) => {
            if (homeStart.current === null) return
            const up = homeStart.current - e.clientY
            homeStart.current = null
            if (Math.abs(up) > DRAG_SLOP) suppressClick.current = true
            if (up >= HOME_SWIPE) goHome()
          }}
          onPointerCancel={() => {
            homeStart.current = null
            suppressClick.current = false
          }}
          onClick={(e) => {
            // Keyboard clicks have detail 0; only a pointer click can be the tail of a drag.
            if (e.detail > 0 && suppressClick.current) {
              suppressClick.current = false
              return
            }
            goHome()
          }}
          className="flex h-11 w-full touch-none items-center justify-center focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-link"
        >
          <span aria-hidden="true" className="h-[5px] w-[134px] rounded-full bg-text-1" />
        </button>
      </div>
    </div>
  )
}
