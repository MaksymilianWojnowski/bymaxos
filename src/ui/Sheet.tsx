import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Centered modal: focus is trapped inside, Escape closes, and focus returns to the opener on unmount.
export function Sheet({ title, onClose, children }: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current
      if (!panel) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panel.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 font-sans">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[80vh] w-[min(440px,calc(100vw-32px))] flex-col gap-4 overflow-auto rounded-[12px] p-5 text-[13px] text-text-1 shadow-lg outline-none"
        style={{
          background: 'var(--menu-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          border: '0.5px solid var(--glass-border)',
        }}
      >
        <h2 id={titleId} className="text-[15px] font-semibold">
          {title}
        </h2>
        {children}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] bg-accent-strong px-3 py-1 text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
