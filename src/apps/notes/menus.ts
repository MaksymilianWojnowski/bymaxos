import type { Command } from '../../system/commands'
import { shortcutLabel } from '../../system/shortcuts'
import type { MenuContext, MenuDef, MenuItemDef } from '../types'

const item = (label: string, command: Command, ctx: MenuContext): MenuItemDef => ({
  label,
  command,
  shortcut: shortcutLabel(command, ctx.keyboardLocked),
})

// Undo and Redo stay listed but disabled: Notes registers no handler for them.
export function notesMenus(ctx: MenuContext): MenuDef[] {
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        item('New Note', { type: 'notes.newNote' }, ctx),
        { separator: true },
        item('Close Window', { type: 'window.close' }, ctx),
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        item('Undo', { type: 'edit.undo' }, ctx),
        item('Redo', { type: 'edit.redo' }, ctx),
        { separator: true },
        item('Copy', { type: 'edit.copy' }, ctx),
        item('Paste', { type: 'edit.paste' }, ctx),
        item('Select All', { type: 'edit.selectAll' }, ctx),
      ],
    },
  ]
}
