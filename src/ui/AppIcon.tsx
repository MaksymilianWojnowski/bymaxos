import { useSyncExternalStore } from 'react'
import { APPS } from '../apps/registry'
import { darkIcons, darkIconsComplete } from '../apps/darkIcons'
import type { AppDefinition } from '../apps/types'
import { useShell } from '../system/shell'
import { CalendarIcon } from './CalendarIcon'

const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
const isDarkTheme = () => document.documentElement.dataset.theme === 'dark'

// Decorative only: the labels come from the parent (dock tooltip, desktop icon caption).
export function AppIcon({ app, size }: { app: AppDefinition; size: number }) {
  const { icon } = app
  const shell = useShell()
  const darkTheme = useSyncExternalStore(subscribeTheme, isDarkTheme)
  // Phone only: the desktop keeps the light artwork and glyph tiles in dark mode.
  const dark = darkTheme && shell === 'mobile' && darkIconsComplete(APPS)
  if ('live' in icon) return <CalendarIcon size={size} dark={dark} />
  if ('image' in icon) {
    const src = dark && icon.darkKey ? darkIcons[icon.darkKey] : icon.image
    return <img src={src} alt="" aria-hidden="true" draggable={false} style={{ width: size, height: size }} />
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
          background: dark ? '#1c1c1e' : icon.background,
          color: dark ? (icon.darkGlyph ?? icon.color) : icon.color,
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25)',
        }}
      >
        <Glyph aria-hidden className="h-[55%] w-[55%]" />
      </div>
    </div>
  )
}
