import { useMemo } from 'react'
import type { MenuContext } from '../../apps/types'
import { useSystem } from '../../system/store'
import { activeAppId } from '../../system/wm'
import { MenuBarMenus } from '../../ui/Menu'
import { buildMenus } from './menus'
import { ShortcutsSheet } from './ShortcutsSheet'
import { StatusArea } from './StatusArea'

export function MenuBar() {
  // Menus read only window ids and titles, so a drag (which changes rects only) must not rebuild them.
  const windowsKey = useSystem((s) =>
    s.wm.windows.map((w) => `${w.id}\u0000${w.title}\u0000${w.appId}`).join('\u0001'),
  )
  const focusedId = useSystem((s) => s.wm.focusedId)
  const keyboardLocked = useSystem((s) => s.keyboardLocked)
  const appId = useSystem((s) => activeAppId(s.wm))
  const overlay = useSystem((s) => s.overlay)
  // openMenuId rebuilds the menus on open, so app state read at build time (e.g. a Finder checkmark) is fresh.
  const openMenuId = useSystem((s) => s.openMenuId)
  // windowsKey and focusedId are change signals only: the body reads the store snapshot they stand for.
  const menus = useMemo(() => {
    const { wm } = useSystem.getState()
    const ctx: MenuContext = {
      focused: wm.windows.find((w) => w.id === wm.focusedId) ?? null,
      windows: wm.windows,
      keyboardLocked,
    }
    return buildMenus(ctx, appId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowsKey, focusedId, keyboardLocked, appId, openMenuId])

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-50 flex h-[var(--mb-h)] items-center justify-between border-b px-2"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderColor: 'var(--glass-border)',
        }}
      >
        <MenuBarMenus menus={menus} />
        <StatusArea />
      </div>
      {overlay === 'shortcuts' && <ShortcutsSheet />}
    </>
  )
}
