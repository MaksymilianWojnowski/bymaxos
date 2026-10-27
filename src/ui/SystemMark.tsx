// The custom "M" system mark (not an Apple glyph). Shared by the menu bar and About This Mac.
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
      <path d="M2.5 12.5V3.5L8 9l5.5-5.5v9" />
    </svg>
  )
}
