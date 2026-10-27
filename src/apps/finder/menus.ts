import type { MenuContext, MenuDef, MenuItemDef } from '../types'
import type { Command } from '../../system/commands'
import { shortcutLabel } from '../../system/shortcuts'
import type { FinderView } from './finderState'
import { vfs } from './vfsInstance'

// Finder views publish their layout here so the View menu can show the checkmark; menus cannot see Finder state.
export const finderViews = new Map<string, FinderView>()

const item = (label: string, command: Command, ctx: MenuContext): MenuItemDef => ({
  label,
  command,
  shortcut: shortcutLabel(command, ctx.keyboardLocked),
})

const GO_FOLDERS = ['desktop', 'documents', 'about', 'work', 'projects']

export function finderMenus(ctx: MenuContext): MenuDef[] {
  const view = (ctx.focused && finderViews.get(ctx.focused.id)) ?? 'icons'
  const viewItem = (label: string, target: FinderView, command: Command): MenuItemDef => ({
    ...item(label, command, ctx),
    checked: view === target,
  })
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        item('New Finder Window', { type: 'file.newWindow' }, ctx),
        item('Open', { type: 'finder.open' }, ctx),
        { separator: true },
        item('Close Window', { type: 'window.close' }, ctx),
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        viewItem('as Icons', 'icons', { type: 'view.icons' }),
        viewItem('as List', 'list', { type: 'view.list' }),
      ],
    },
    {
      id: 'go',
      label: 'Go',
      items: [
        item('Back', { type: 'finder.back' }, ctx),
        item('Forward', { type: 'finder.forward' }, ctx),
        { separator: true },
        ...GO_FOLDERS.map((folderId) => ({
          label: vfs.nodes[folderId]?.name ?? folderId,
          command: { type: 'finder.navigate', folderId },
        })),
      ],
    },
  ]
}
