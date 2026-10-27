import { useSystem } from '../../system/store'
import type { Rect } from '../../system/types'

export interface MissionLabel {
  id: string
  title: string
  rect: Rect
}

const LABEL_SHADOW = { textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }

// Dimmed backdrop and window titles; the windows themselves are rendered by WindowLayer above this.
// The tint stays at 0.55 opacity under reduce-transparency too, since white labels need it for contrast.
export function MissionControl({ labels }: { labels: MissionLabel[] }) {
  const setOverlay = useSystem((s) => s.setOverlay)

  return (
    <>
      <div
        data-testid="mission-backdrop"
        className="absolute inset-0 pointer-events-auto bg-black/55"
        onClick={() => setOverlay(null)}
      />
      {labels.map(({ id, title, rect }) => (
        <div
          key={id}
          className="pointer-events-none absolute truncate text-center text-[13px] text-white"
          style={{ ...LABEL_SHADOW, left: rect.x, top: rect.y + rect.h + 6, width: rect.w }}
        >
          {title}
        </div>
      ))}
      {labels.length === 0 && (
        <p
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[15px] text-white"
          style={LABEL_SHADOW}
        >
          No open windows
        </p>
      )}
    </>
  )
}
