import type { Command } from '../../system/commands'
import { shortcutLabel } from '../../system/shortcuts'
import type { MenuContext, MenuDef, MenuItemDef } from '../types'

const item = (label: string, command: Command, ctx: MenuContext): MenuItemDef => ({
  label,
  command,
  shortcut: shortcutLabel(command, ctx.keyboardLocked),
})

export function resumeMenus(ctx: MenuContext): MenuDef[] {
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        item('Print…', { type: 'resume.print' }, ctx),
        { separator: true },
        item('Close Window', { type: 'window.close' }, ctx),
      ],
    },
  ]
}
