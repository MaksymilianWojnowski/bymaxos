// The custom "M" system mark (not an Apple glyph). Shared by the menu bar and About This Mac.
const MARK_PATH = 'M2.5 12.5V3.5L8 9l5.5-5.5v9'

export function SystemMark({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="bymaxOS"
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={MARK_PATH} />
    </svg>
  )
}

// Decorative twin for app tiles: the labels come from the parent, so no role or name here.
export function SystemMarkGlyph({ className, 'aria-hidden': ariaHidden }: { className?: string; 'aria-hidden'?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d={MARK_PATH} />
    </svg>
  )
}
