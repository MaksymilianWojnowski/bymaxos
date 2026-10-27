import finderIcon from '../assets/icons/finder.png'
import mailIcon from '../assets/icons/mail.png'
import previewIcon from '../assets/icons/preview.png'
import systemInfoIcon from '../assets/icons/system-information.png'
import texteditIcon from '../assets/icons/textedit.png'
import trashIcon from '../assets/icons/trash.png'
import { getContent } from '../content'
import { shortcutLabel } from '../system/shortcuts'
import { setAppResolver } from '../system/store'
import type { Command } from '../system/commands'
import type { AppId, WindowSpec } from '../system/types'
import { GitHubGlyph, LinkedInGlyph } from '../ui/glyphs'
import { finderMenus } from './finder/menus'
import type { AppDefinition, MenuContext, MenuDef, MenuItemDef } from './types'

const LINK_GROUP_ORDER: Record<'system' | 'apps' | 'links' | 'trash', number> = {
  system: 0,
  apps: 1,
  links: 2,
  trash: 3,
}

const linkApp = (id: string, icon: AppDefinition['icon'], order: number): AppDefinition | null => {
  const link = getContent().links.find((l) => l.id === id)
  if (!link) return null
  return {
    id,
    name: link.label,
    icon,
    external: link.url,
    dock: { order, group: 'links' },
    mobile: { presentation: 'external' },
  }
}

const APP_LIST: (AppDefinition | null)[] = [
  {
    id: 'finder',
    name: 'Finder',
    icon: { image: finderIcon },
    load: () => import('./finder/Finder'),
    menus: finderMenus,
    window: {
      defaultSize: { w: 900, h: 560 },
      minSize: { w: 520, h: 320 },
      resizable: true,
      singleInstance: false,
    },
    dock: { order: 1, group: 'system' },
  },
  {
    id: 'quicklook',
    name: 'Quick Look',
    deepLink: false,
    icon: { image: previewIcon },
    load: () => import('./quicklook/QuickLook'),
    window: {
      defaultSize: { w: 640, h: 520 },
      minSize: { w: 360, h: 280 },
      resizable: true,
      singleInstance: false,
    },
  },
  {
    id: 'textedit',
    name: 'TextEdit',
    deepLink: false,
    icon: { image: texteditIcon },
    load: () => import('./textedit/TextEdit'),
    window: {
      defaultSize: { w: 620, h: 560 },
      minSize: { w: 360, h: 280 },
      resizable: true,
      singleInstance: false,
      documentKey: 'fileId',
    },
  },
  {
    id: 'mail',
    name: 'Mail',
    icon: { image: mailIcon },
    load: () => import('./mail/Mail'),
    menus: (ctx) => [
      {
        id: 'file',
        label: 'File',
        items: [
          item('Send', { type: 'mail.send' }, ctx),
          SEP,
          item('Close Window', { type: 'window.close' }, ctx),
        ],
      },
    ],
    window: {
      defaultSize: { w: 640, h: 520 },
      minSize: { w: 420, h: 360 },
      resizable: true,
      singleInstance: true,
    },
    dock: { order: 1, group: 'apps' },
  },
  {
    id: 'about',
    name: 'About This Mac',
    icon: { image: systemInfoIcon },
    load: () => import('./about/AboutThisMac'),
    window: {
      defaultSize: { w: 340, h: 420 },
      minSize: { w: 340, h: 420 },
      resizable: false,
      singleInstance: true,
    },
  },
  linkApp(
    'linkedin',
    {
      glyph: LinkedInGlyph,
      background: 'linear-gradient(180deg, #1f7fd0 0%, #0a66c2 100%)',
      color: '#ffffff',
    },
    1,
  ),
  linkApp(
    'github',
    {
      glyph: GitHubGlyph,
      background: 'linear-gradient(180deg, #3d4450 0%, #161b22 100%)',
      color: '#ffffff',
    },
    2,
  ),
  {
    id: 'trash',
    name: 'Trash',
    icon: { image: trashIcon },
    alias: { appId: 'finder', props: { folderId: 'trash' } },
    dock: { order: 1, group: 'trash' },
  },
]

export const APPS: AppDefinition[] = APP_LIST.filter((a): a is AppDefinition => a !== null)

export function getApp(id: AppId): AppDefinition | undefined {
  return APPS.find((a) => a.id === id)
}

type Docked = AppDefinition & { dock: NonNullable<AppDefinition['dock']> }

export function dockItems(): Docked[] {
  return APPS.filter((a): a is Docked => a.dock !== undefined).sort(
    (a, b) =>
      LINK_GROUP_ORDER[a.dock.group] - LINK_GROUP_ORDER[b.dock.group] || a.dock.order - b.dock.order,
  )
}

// Only apps with a window and a loader open as windows; external links and aliases resolve to nothing.
function resolveWindowSpec(id: AppId): WindowSpec | undefined {
  const app = getApp(id)
  if (!app?.load || !app.window) return undefined
  return {
    appId: id,
    title: app.name,
    defaultSize: app.window.defaultSize,
    minSize: app.window.minSize,
    singleInstance: app.window.singleInstance,
    resizable: app.window.resizable,
    documentKey: app.window.documentKey,
  }
}
setAppResolver(resolveWindowSpec)

const item = (label: string, command: Command, ctx: MenuContext): MenuItemDef => ({
  label,
  command,
  shortcut: shortcutLabel(command, ctx.keyboardLocked),
})

const SEP: MenuItemDef = { separator: true }

export function defaultMenus(ctx: MenuContext): MenuDef[] {
  const menus: MenuDef[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        item('New Window', { type: 'file.newWindow' }, ctx),
        item('Close Window', { type: 'window.close' }, ctx),
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        item('Undo', { type: 'edit.undo' }, ctx),
        item('Redo', { type: 'edit.redo' }, ctx),
        SEP,
        item('Cut', { type: 'edit.cut' }, ctx),
        item('Copy', { type: 'edit.copy' }, ctx),
        item('Paste', { type: 'edit.paste' }, ctx),
        item('Select All', { type: 'edit.selectAll' }, ctx),
      ],
    },
    { id: 'view', label: 'View', items: [] },
    {
      id: 'window',
      label: 'Window',
      items: [
        item('Minimize', { type: 'window.minimize' }, ctx),
        item('Zoom', { type: 'window.zoom' }, ctx),
        SEP,
        item('Bring All to Front', { type: 'window.bringAllToFront' }, ctx),
        ...(ctx.windows.length > 0
          ? [
              SEP,
              ...ctx.windows.map<MenuItemDef>((w) => ({
                label: w.title,
                command: { type: 'window.focus', id: w.id },
                checked: ctx.focused?.id === w.id,
              })),
            ]
          : []),
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        item('Keyboard Shortcuts', { type: 'overlay.open', overlay: 'shortcuts' }, ctx),
        item('About bymaxOS', { type: 'app.open', appId: 'about' }, ctx),
      ],
    },
  ]
  return menus.filter((m) => m.items.length > 0)
}
