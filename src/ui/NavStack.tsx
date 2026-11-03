import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ChevronLeft } from 'lucide-react'
import { EDGE_WIDTH, releaseVelocity, shouldEdgeBack, type Sample } from '../shells/mobile/gestures'

interface Props {
  title: string
  listActions?: ReactNode
  list: ReactNode
  open: boolean
  detailTitle: string
  detailActions?: ReactNode
  onBack: () => void
  detail: ReactNode
}

// A list pane and a detail pane that slides over it. Phones only, so no phone: variants.
export function NavStack({ title, listActions, list, open, detailTitle, detailActions, onBack, detail }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const listPane = useRef<HTMLDivElement>(null)
  const detailPane = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(open)
  const gesture = useRef<{ startX: number; startY: number; samples: Sample[] } | null>(null)

  // Focus moves only when open changes, and not when a child already took focus inside the detail.
  useEffect(() => {
    if (wasOpen.current === open) return
    wasOpen.current = open
    if (open && !detailPane.current?.contains(document.activeElement)) {
      heading.current?.focus({ preventScroll: true })
    }
  }, [open])

  const goBack = () => {
    // Focus can only land once the list pane is no longer inert, so the state change commits first.
    flushSync(onBack)
    const row = opener.current
    const target = row?.isConnected ? row : listPane.current?.querySelector<HTMLElement>('button, input')
    target?.focus()
  }

  const clearDrag = () => {
    if (!detailPane.current) return
    detailPane.current.style.transform = ''
    detailPane.current.style.transition = ''
  }

  const onDetailKey = (e: KeyboardEvent<HTMLDivElement>) => {
    // Keys from a portalled sheet bubble here through React, so only this pane's own DOM counts.
    if (e.key === 'Escape' && e.currentTarget.contains(e.target as Node)) goBack()
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!open || e.clientX > EDGE_WIDTH) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    gesture.current = { startX: e.clientX, startY: e.clientY, samples: [{ y: -e.clientX, t: e.timeStamp }] }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    g.samples = [...g.samples.filter((s) => e.timeStamp - s.t <= 100), { y: -e.clientX, t: e.timeStamp }]
    if (dx > Math.abs(dy) && detailPane.current) {
      detailPane.current.style.transition = 'none'
      detailPane.current.style.transform = `translateX(${dx}px)`
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    clearDrag()
    if (!g) return
    const width = root.current?.offsetWidth ?? 0
    const dx = e.clientX - g.startX
    if (shouldEdgeBack(g.startX, dx, e.clientY - g.startY, width, releaseVelocity(g.samples, e.timeStamp))) goBack()
  }

  const onPointerCancel = () => {
    gesture.current = null
    clearDrag()
  }

  return (
    <div
      ref={root}
      className="relative h-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={listPane}
        inert={open}
        aria-hidden={open || undefined}
        onClickCapture={(e) => {
          opener.current = (e.target as Element).closest('button')
        }}
        className="absolute inset-0 flex flex-col bg-window"
      >
        <header className="flex h-11 shrink-0 items-center px-1">
          <span className="min-w-11" />
          <h2 className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-text-1">{title}</h2>
          <div className="flex min-w-11 justify-end">{listActions}</div>
        </header>
        <div
          tabIndex={0}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-link focus-visible:outline-none"
        >
          {list}
        </div>
      </div>

      <div
        ref={detailPane}
        data-detail-pane
        inert={!open}
        aria-hidden={!open || undefined}
        onKeyDown={onDetailKey}
        className={`absolute inset-0 flex touch-pan-y flex-col bg-window transition-[transform,visibility] duration-[220ms] ${open ? '' : 'invisible translate-x-full'}`}
      >
        <header className="flex h-11 shrink-0 items-center px-1">
          <button
            type="button"
            onClick={goBack}
            className="flex min-h-11 min-w-11 items-center gap-0.5 rounded-md pr-2 text-[15px] text-accent-link focus-visible:ring-2 focus-visible:ring-accent-link focus-visible:outline-none"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
            Back
          </button>
          <h2
            ref={heading}
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold text-text-1 outline-none"
          >
            {detailTitle}
          </h2>
          <div className="flex min-w-11 justify-end">{detailActions}</div>
        </header>
        <div
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-link focus-visible:outline-none"
        >
          {detail}
        </div>
      </div>
    </div>
  )
}
