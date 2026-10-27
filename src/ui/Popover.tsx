import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  anchor: DOMRect
  onClose: () => void
  children: ReactNode
  label: string
  // The toggle button: a press on it must not close the popover before the button's own click reopens it.
  anchorEl?: HTMLElement | null
}

export function Popover({ anchor, onClose, children, label, anchorEl }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width } = el.getBoundingClientRect()
    el.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - width - 4))}px`
  }, [anchor])

  useEffect(() => {
    const onDown = (e: Event) => {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchorEl?.contains(target)) return
      onClose()
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
  }, [onClose, anchorEl])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="fixed z-50 rounded-mac-menu p-3 font-sans text-[13px] text-text-1 shadow-lg"
      style={{
        top: anchor.bottom + 6,
        left: anchor.left,
        background: 'var(--menu-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
