import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  anchor: DOMRect
  onClose: () => void
  children: ReactNode
  label: string
}

export function Popover({ anchor, onClose, children, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width } = el.getBoundingClientRect()
    el.style.left = `${Math.max(4, Math.min(anchor.left, window.innerWidth - width - 4))}px`
  }, [anchor])

  useEffect(() => {
    const onDown = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
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
  }, [onClose])

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
