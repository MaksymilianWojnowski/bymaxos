import type { AppDefinition } from '../apps/types'

// Decorative only: the labels come from the parent (dock tooltip, desktop icon caption).
export function AppIcon({ app, size }: { app: AppDefinition; size: number }) {
  const Glyph = app.icon.glyph
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: '22.5%',
        background: app.icon.background,
        color: app.icon.color,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25)',
      }}
    >
      <Glyph aria-hidden className="h-[55%] w-[55%]" />
    </div>
  )
}
