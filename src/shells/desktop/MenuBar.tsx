import type { MenuContext } from '../../apps/types'
import { useSystem } from '../../system/store'
import { activeAppId } from '../../system/wm'
import { MenuBarMenus } from '../../ui/Menu'
import { buildMenus } from './menus'
import { ShortcutsSheet } from './ShortcutsSheet'
import { StatusArea } from './StatusArea'

export function MenuBar() {
  const wm = useSystem((s) => s.wm)
  const keyboardLocked = useSystem((s) => s.keyboardLocked)
  const overlay = useSystem((s) => s.overlay)
  const ctx: MenuContext = {
    focused: wm.windows.find((w) => w.id === wm.focusedId) ?? null,
    windows: wm.windows,
    keyboardLocked,
  }
  const menus = buildMenus(ctx, activeAppId(wm))

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
