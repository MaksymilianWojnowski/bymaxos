import type { AppDefinition } from '../apps/types'

// Decorative only: the labels come from the parent (dock tooltip, desktop icon caption).
export function AppIcon({ app, size }: { app: AppDefinition; size: number }) {
  const { icon } = app
  if ('image' in icon) {
    return <img src={icon.image} alt="" aria-hidden="true" draggable={false} style={{ width: size, height: size }} />
  }
  const Glyph = icon.glyph
  // Brand marks (LinkedIn, GitHub) have no macOS artwork; draw them inside the same icon grid.
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center"
      style={{ width: size, height: size, padding: size * 0.1 }}
    >
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          borderRadius: '22.5%',
          background: icon.background,
          color: icon.color,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25)',
        }}
      >
        <Glyph aria-hidden className="h-[55%] w-[55%]" />
      </div>
    </div>
  )
}
