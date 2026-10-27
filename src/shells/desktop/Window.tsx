import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Minus, Plus, X, type LucideIcon } from 'lucide-react'
import type { AppDefinition } from '../../apps/types'
import { useSystem } from '../../system/store'
import type { Rect, WindowState } from '../../system/types'
import { dockIconRects } from './dockIconRects'
import { resizeRect, type ResizeDir } from './resize'

interface Props {
  win: WindowState
  app: AppDefinition
  focused: boolean
  children: ReactNode
}

type Gesture =
  | { kind: 'drag'; px: number; py: number; origin: Rect }
  | { kind: 'resize'; dir: ResizeDir; px: number; py: number; start: Rect }

const HANDLES: Record<ResizeDir, CSSProperties> = {
  n: { top: 0, left: 12, right: 12, height: 6, cursor: 'ns-resize' },
  s: { bottom: 0, left: 12, right: 12, height: 6, cursor: 'ns-resize' },
  e: { top: 12, bottom: 12, right: 0, width: 6, cursor: 'ew-resize' },
  w: { top: 12, bottom: 12, left: 0, width: 6, cursor: 'ew-resize' },
  nw: { top: 0, left: 0, width: 12, height: 12, cursor: 'nwse-resize' },
  se: { bottom: 0, right: 0, width: 12, height: 12, cursor: 'nwse-resize' },
  ne: { top: 0, right: 0, width: 12, height: 12, cursor: 'nesw-resize' },
  sw: { bottom: 0, left: 0, width: 12, height: 12, cursor: 'nesw-resize' },
}

const LIGHTS: { name: 'Close' | 'Minimize' | 'Zoom'; color: string; Glyph: LucideIcon }[] = [
  { name: 'Close', color: '#ff5f57', Glyph: X },
  { name: 'Minimize', color: '#febc2e', Glyph: Minus },
  { name: 'Zoom', color: '#28c840', Glyph: Plus },
]

// Traffic-light clicks must not start a drag or a zoom, so the title bar checks for them.
const onTrafficLight = (target: EventTarget): boolean =>
  target instanceof Element && target.closest('[data-traffic]') !== null

export function Window({ win, app, focused, children }: Props) {
  const focus = useSystem((s) => s.focus)
  const close = useSystem((s) => s.close)
  const minimizeWin = useSystem((s) => s.minimize)
  const toggleMaximize = useSystem((s) => s.toggleMaximize)
  const move = useSystem((s) => s.move)
  const setRect = useSystem((s) => s.setRect)

  const rootRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const animating = useRef(false)
  const animation = useRef<Animation | null>(null)
  const resizable = app.window?.resizable ?? false
  const minSize = app.window?.minSize ?? { w: 0, h: 0 }
  const titleId = `win-title-${win.id}`

  // Focus the window on open; hand focus back to whatever had it before the window existed.
  useEffect(() => {
    const previous = document.activeElement
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  // Cancelling on unmount stops a minimize still in flight when the window closes.
  useEffect(() => () => animation.current?.cancel(), [])

  const minimize = () => {
    if (animating.current) return
    const el = rootRef.current
    const target = dockIconRects.get(win.appId)
    const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    if (reduceMotion || !target || !el || typeof el.animate !== 'function') {
      minimizeWin(win.id)
      return
    }
    animating.current = true
    const from = el.getBoundingClientRect()
    const dx = target.x + target.width / 2 - (from.x + from.width / 2)
    const dy = target.y + target.height / 2 - (from.y + from.height / 2)
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0 },
      ],
      { duration: 220, easing: 'ease-in', fill: 'forwards' },
    )
    animation.current = anim
    anim.onfinish = () => minimizeWin(win.id)
    // cancel() does not fire onfinish, so a cancelled run must release the guard here.
    anim.oncancel = () => {
      animating.current = false
    }
  }

  const onTitlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || onTrafficLight(e.target)) return
    gesture.current = {
      kind: 'drag',
      px: e.clientX,
      py: e.clientY,
      origin: win.rect,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onHandlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const dir = e.currentTarget.dataset.resize as ResizeDir
    gesture.current = { kind: 'resize', dir, px: e.clientX, py: e.clientY, start: win.rect }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  // Both gestures are handled on the root: pointer capture routes moves there from the title bar or a handle.
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.px
    const dy = e.clientY - g.py
    if (g.kind === 'drag') {
      move(win.id, g.origin.x + dx, g.origin.y + dy)
    } else {
      setRect(win.id, resizeRect(g.start, g.dir, dx, dy, minSize))
    }
  }

  const endGesture = () => {
    gesture.current = null
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-window-id={win.id}
      className="animate-window-open pointer-events-auto absolute flex flex-col overflow-hidden rounded-[var(--radius-window)] bg-window outline-none"
      style={{
        left: win.rect.x,
        top: win.rect.y,
        width: win.rect.w,
        height: win.rect.h,
        zIndex: win.z,
        boxShadow: focused ? 'var(--shadow-window)' : 'var(--shadow-window-inactive)',
      }}
      onPointerDown={() => {
        if (!focused) focus(win.id)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      <div
        data-testid="titlebar"
        className="relative flex shrink-0 touch-none items-center border-b border-black/10 select-none"
        style={{ height: 'var(--tb-h)' }}
        onPointerDown={onTitlePointerDown}
        onDoubleClick={(e) => {
          if (resizable && !onTrafficLight(e.target)) toggleMaximize(win.id)
        }}
      >
        <div data-traffic className="group absolute top-1/2 left-3 flex -translate-y-1/2 gap-2">
          {LIGHTS.map(({ name, color, Glyph }) => {
            const disabled = name === 'Zoom' && !resizable
            const onClick = () => {
              if (name === 'Close') close(win.id)
              else if (name === 'Minimize') minimize()
              else toggleMaximize(win.id)
            }
            return (
              <button
                key={name}
                type="button"
                aria-label={name}
                disabled={disabled}
                onClick={onClick}
                className="flex h-3 w-3 items-center justify-center rounded-full text-black/60 outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
                style={{ background: focused ? color : 'var(--traffic-inactive)' }}
              >
                <Glyph
                  aria-hidden
                  className="h-2 w-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  strokeWidth={3}
                />
              </button>
            )
          })}
        </div>
        <span
          id={titleId}
          className={`pointer-events-none absolute inset-x-0 truncate px-16 text-center text-[13px] font-semibold text-text-1 ${focused ? '' : 'opacity-50'}`}
        >
          {win.title}
        </span>
      </div>

      <div data-selectable className="relative min-h-0 flex-1 overflow-auto">
        {children}
      </div>

      {resizable &&
        win.mode !== 'maximized' &&
        (Object.keys(HANDLES) as ResizeDir[]).map((dir) => (
          <div
            key={dir}
            aria-hidden="true"
            data-resize={dir}
            data-testid={`resize-${dir}`}
            className="absolute z-10 touch-none"
            style={HANDLES[dir]}
            onPointerDown={onHandlePointerDown}
          />
        ))}
    </div>
  )
}
