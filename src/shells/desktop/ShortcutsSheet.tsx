import { SHORTCUTS } from '../../system/shortcuts'
import { AVAILABLE_OVERLAYS, useSystem, type Overlay } from '../../system/store'
import { Sheet } from '../../ui/Sheet'

// Keyed by command type, plus the overlay for overlay.open entries.
const LABELS: Record<string, string> = {
  'window.close': 'Close window',
  'window.minimize': 'Minimize window',
  'app.quit': 'Quit app',
  'overlay.open:spotlight': 'Spotlight',
  'overlay.open:missionControl': 'Mission Control',
  'switcher.next': 'Switch apps',
  'switcher.prev': 'Switch apps backwards',
  'view.icons': 'View as icons',
  'view.list': 'View as list',
  'file.newWindow': 'New window',
  'overlay.close': 'Close menu or panel',
}

const labelOf = (type: string, overlay?: unknown): string => {
  const key = typeof overlay === 'string' ? `${type}:${overlay}` : type
  return LABELS[key] ?? key
}

export function ShortcutsSheet() {
  const keyboardLocked = useSystem((s) => s.keyboardLocked)
  const setOverlay = useSystem((s) => s.setOverlay)
  // An overlay.open entry for an overlay that is not built yet would do nothing, so it is not listed.
  const rows = SHORTCUTS.filter(
    (s) =>
      (s.when === 'always' || keyboardLocked) &&
      (s.command.type !== 'overlay.open' ||
        AVAILABLE_OVERLAYS.has(s.command.overlay as Exclude<Overlay, null>)),
  )

  return (
    <Sheet title="Keyboard Shortcuts" onClose={() => setOverlay(null)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-text-2">
            <th scope="col" className="pb-2 font-medium">Shortcut</th>
            <th scope="col" className="pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={`${s.combo}-${s.command.type}`} className="border-t border-black/10 dark:border-white/15">
              <td className="py-1.5 pr-4">
                <kbd className="font-sans">{s.combo}</kbd>
              </td>
              <td className="py-1.5">{labelOf(s.command.type, s.command.overlay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[12px] text-text-2">
        Some macOS shortcuts (⌘W, ⌘Tab, ⌘Space) are reserved by your browser. Enter full screen from
        Control Center to use them in Chrome.
      </p>
    </Sheet>
  )
}
