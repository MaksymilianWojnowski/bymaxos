import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Minus, Plus, X, type LucideIcon } from 'lucide-react'
import type { AppDefinition } from '../../apps/types'
import { genieRestores, windowMinimizers } from '../../system/genieSignals'
import { useSystem } from '../../system/store'
import type { Rect, WindowState } from '../../system/types'
import { dockIconRect } from './dockIconRects'
import { cancelGenie, playGenie } from './genieLayer'
import { resizeRect, type ResizeDir } from './resize'

interface Props {
  win: WindowState
  app: AppDefinition
  focused: boolean
  children: ReactNode
  // Set while Mission Control is open: the window scales into its grid cell and picking it calls onPick.
  mission?: { target: Rect; onPick: () => void }
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

// The Dock is a toolbar; focus left on one of its buttons after a restore counts as "nothing took focus".
const DOCK_SELECTOR = '[role="toolbar"][aria-label="Dock"]'
const DESKTOP_SELECTOR = '[role="listbox"][aria-label="Desktop"]'

// A restored window takes focus unless something else holds it: body and the Dock do not count.
function claimFocus(el: HTMLElement): void {
  const active = document.activeElement
  const onDock = active instanceof Element && active.closest(DOCK_SELECTOR) !== null
  if (!active || active === document.body || onDock) el.focus({ preventScroll: true })
}

// A minimized window's focus goes to the store's focused window, else the window's opener, else the Desktop.
// A live opener is attached, is not body, and is not inside a minimized window (focus cannot enter it).
function isLiveOpener(opened: Element | null): opened is HTMLElement {
  return (
    opened instanceof HTMLElement &&
    opened !== document.body &&
    opened.isConnected &&
    opened.closest('[data-window-id][aria-hidden="true"]') === null
  )
}

function handOffFocus(opened: Element | null, focusedId: string | null): void {
  const next = focusedId ? document.querySelector<HTMLElement>(`[data-window-id="${focusedId}"]`) : null
  const target = next ?? (isLiveOpener(opened) ? opened : null) ?? document.querySelector<HTMLElement>(DESKTOP_SELECTOR)
  target?.focus({ preventScroll: true })
}

// Traffic-light clicks must not start a drag or a zoom, so the title bar checks for them.
const onTrafficLight = (target: EventTarget): boolean =>
  target instanceof Element && target.closest('[data-traffic]') !== null

export function Window({ win, app, focused, children, mission }: Props) {
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
  // Read by the registered minimizer, which must see the latest minimize.
  const minimizeNow = useRef<() => void>(() => {})
  const resizable = app.window?.resizable ?? false
  const minSize = app.window?.minSize ?? { w: 0, h: 0 }
  const titleId = `win-title-${win.id}`

  const minimized = win.mode === 'minimized'
  const wasMinimized = useRef(minimized)
  // The focus that existed when this window opened: where focus goes if this window hides.
  const opener = useRef<Element | null>(null)

  // Runs on the minimized transition only: restore plays the reverse genie or Scale, and hiding hands focus away.
  useEffect(() => {
    const was = wasMinimized.current
    wasMinimized.current = minimized
    const el = rootRef.current
    if (minimized) {
      // A Scale minimize's fill would hold the hidden window at scale(0.1); the root is already invisible here.
      animation.current?.cancel()
      animation.current = null
      animating.current = false
      if (!was && el?.contains(document.activeElement)) handOffFocus(opener.current, useSystem.getState().wm.focusedId)
      return
    }
    if (!was || !el) return
    const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    // Consumed on every restore, even under reduce motion, so no stale entry survives.
    const genie = genieRestores.delete(win.id)
    const target = dockIconRect(win.appId)
    if (genie && target && !reduceMotion) {
      // The open animation is still scaling the root, so the box comes from the stored rect, not the live one.
      const parent = el.offsetParent instanceof Element ? el.offsetParent.getBoundingClientRect() : { x: 0, y: 0 }
      const from = { x: parent.x + win.rect.x, y: parent.y + win.rect.y, width: win.rect.w, height: win.rect.h }
      // A minimize still running for this window hands over to the restore.
      cancelGenie(win.id)
      const anims = playGenie(el, from, target, 'restore', win.id)
      if (anims) {
        el.style.visibility = 'hidden'
        Promise.all(anims.map((a) => a.finished)).then(
          () => {
            el.style.visibility = ''
            claimFocus(el)
          },
          () => {},
        )
        // StrictMode and a re-minimize both clean up: the cancel leaves the window visible.
        return () => {
          cancelGenie(win.id, anims)
          el.style.visibility = ''
        }
      }
    }
    claimFocus(el)
    if (!reduceMotion && typeof el.animate === 'function') {
      el.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'none' }], {
        duration: 160,
        easing: 'ease-out',
      })
    }
    // Keyed on the transition only: the rect and app do not change while the window is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimized])

  // The Dock calls minimize through the store; this entry gives it the genie.
  useEffect(() => {
    const id = win.id
    windowMinimizers.set(id, () => minimizeNow.current())
    return () => {
      windowMinimizers.delete(id)
    }
  }, [win.id])

  // Focus the window on open; hand focus back to whatever had it before the window existed.
  useEffect(() => {
    const previous = document.activeElement
    const el = rootRef.current
    opener.current = previous
    el?.focus({ preventScroll: true })
    return () => {
      // A hidden window closed from elsewhere must not pull focus off the window the user is in.
      const active = document.activeElement
      const holdsFocus = !active || active === document.body || (el !== null && el.contains(active))
      if (holdsFocus) handOffFocus(previous, null)
    }
  }, [])

  // Cancelling on unmount stops a Scale minimize still in flight when the window closes.
  useEffect(() => () => animation.current?.cancel(), [])

  const minimize = () => {
    if (animating.current) return
    const el = rootRef.current
    const target = dockIconRect(win.appId)
    const reduceMotion = document.documentElement.classList.contains('reduce-motion')
    // Under Mission Control the window already carries a scale transform, which the clone would apply a second time.
    if (reduceMotion || !target || !el || mission) {
      minimizeWin(win.id)
      return
    }
    // The genie clones the window synchronously and runs on its own layer, so the window minimizes at once.
    if (playGenie(el, el.getBoundingClientRect(), target, 'minimize', win.id)) {
      minimizeWin(win.id)
      return
    }
    // Scale fallback: used when the genie cannot run (no animate, or too many DOM nodes).
    if (typeof el.animate !== 'function') {
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

  useEffect(() => {
    minimizeNow.current = minimize
  })

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
      aria-hidden={minimized ? 'true' : undefined}
      inert={minimized}
      tabIndex={-1}
      data-window-id={win.id}
      className={`animate-window-open absolute flex flex-col overflow-hidden rounded-[var(--radius-window)] bg-window outline-none ${minimized ? 'invisible pointer-events-none' : 'pointer-events-auto'}`}
      style={{
        left: win.rect.x,
        top: win.rect.y,
        width: win.rect.w,
        height: win.rect.h,
        zIndex: win.z,
        boxShadow: focused ? 'var(--shadow-window)' : 'var(--shadow-window-inactive)',
        // Scales from the top-left corner. reduce-motion's global rule drops this transition too.
        ...(mission && {
          transformOrigin: '0 0',
          transform: `translate(${mission.target.x - win.rect.x}px, ${mission.target.y - win.rect.y}px) scale(${mission.target.w / win.rect.w})`,
          transition: 'transform 300ms ease',
        }),
      }}
      onPointerDown={() => {
        // In Mission Control a press must not raise the window: that would re-sort the grid under the cursor.
        if (!focused && !mission) focus(win.id)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      <div
        data-testid="titlebar"
        inert={mission !== undefined}
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
                className="flex h-3 w-3 items-center justify-center rounded-full text-black/60 outline-none focus-visible:ring-2 focus-visible:ring-accent-link disabled:opacity-40"
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
          className={`pointer-events-none absolute inset-x-0 truncate px-16 text-center text-[13px] font-semibold ${focused ? 'text-text-1' : 'text-text-2'}`}
        >
          {win.title}
        </span>
      </div>

      <div data-selectable inert={mission !== undefined} className="relative min-h-0 flex-1 overflow-auto">
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

      {mission && (
        <button
          type="button"
          aria-label={`Show ${win.title}`}
          onClick={mission.onPick}
          className="absolute inset-0 z-20 outline-none hover:ring-4 hover:ring-inset hover:ring-accent-link focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent-link"
        />
      )}
    </div>
  )
}
