import { defaultMenus, getApp } from '../../apps/registry'
import type { MenuContext, MenuDef, MenuItemDef } from '../../apps/types'
import type { Command } from '../../system/commands'
import { shortcutLabel } from '../../system/shortcuts'
import type { AppId } from '../../system/types'

// Known menu ids in display order; app menus with other ids go in front of Window.
const MENU_ORDER = ['file', 'edit', 'view', 'go', 'window', 'help']

const rank = (id: string): number => {
  const i = MENU_ORDER.indexOf(id)
  return i === -1 ? MENU_ORDER.indexOf('window') - 0.5 : i
}

const withShortcut = (label: string, command: Command, ctx: MenuContext): MenuItemDef => ({
  label,
  command,
  shortcut: shortcutLabel(command, ctx.keyboardLocked),
})

const SEP: MenuItemDef = { separator: true }

function systemMenu(ctx: MenuContext): MenuDef {
  return {
    id: 'system',
    label: (
      <svg
        role="img"
        aria-label="bymaxOS"
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 12.5V3.5L8 9l5.5-5.5v9" />
      </svg>
    ),
    items: [
      { label: 'About This Mac', command: { type: 'app.open', appId: 'about' } },
      SEP,
      withShortcut('System Settings…', { type: 'overlay.open', overlay: 'controlCenter' }, ctx),
      SEP,
      { label: 'Lock Screen', command: { type: 'system.lock' } },
      { label: 'Restart…', command: { type: 'system.restart' } },
    ],
  }
}

function appMenu(appName: string, ctx: MenuContext): MenuDef {
  return {
    id: 'app',
    label: <span className="font-semibold">{appName}</span>,
    items: [
      { label: `About ${appName}`, command: { type: 'app.open', appId: 'about' } },
      SEP,
      { label: `Hide ${appName}`, command: { type: 'app.hide' } },
      withShortcut(`Quit ${appName}`, { type: 'app.quit' }, ctx),
    ],
  }
}

// App menus replace the default menu with the same id; unknown ids are added before Window.
export function buildMenus(ctx: MenuContext, appId: AppId): MenuDef[] {
  const app = getApp(appId)
  const appMenus = app?.menus?.(ctx) ?? []
  const defaults = defaultMenus(ctx)
  const replaced = defaults.map((m) => appMenus.find((a) => a.id === m.id) ?? m)
  const added = appMenus.filter((a) => !defaults.some((m) => m.id === a.id))
  const rest = [...replaced, ...added]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m.id) - rank(b.m.id) || a.i - b.i)
    .map(({ m }) => m)
    .filter((m) => m.items.length > 0)
  return [systemMenu(ctx), appMenu(app?.name ?? 'Finder', ctx), ...rest]
}
