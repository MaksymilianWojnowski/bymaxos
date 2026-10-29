import { beforeEach, describe, expect, it } from 'vitest'
import { resetSystem, useSystem } from '../system/store'
import type { WindowState } from '../system/types'
import { APPS, defaultMenus, dockItems, getApp, launchpadApps } from './registry'

const win = (id: string, title: string): WindowState => ({
  id,
  appId: 'finder',
  title,
  rect: { x: 0, y: 0, w: 100, h: 100 },
  mode: 'normal',
  z: 1,
})

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.getState().setViewport(1440, 900)
})

describe('registry', () => {
  it('lists dock items by group then order', () => {
    expect(dockItems().map((a) => a.id)).toEqual(['launchpad', 'finder', 'resume', 'mail', 'contacts', 'calendar', 'developer', 'terminal', 'settings', 'linkedin', 'github', 'trash'])
  })

  it('numbers the apps dock group as Mail 2, Contacts 3, Calendar 4, Developer 9, Terminal 10, System Settings 11', () => {
    const apps = dockItems().filter((a) => a.dock.group === 'apps')
    expect(apps.map((a) => [a.name, a.dock.order])).toEqual([
      ['Mail', 2],
      ['Contacts', 3],
      ['Calendar', 4],
      ['Developer', 9],
      ['Terminal', 10],
      ['System Settings', 11],
    ])
  })

  it('lists launchable apps for Launchpad sorted by name, leaving out hidden, file-only and overlay apps', () => {
    const names = launchpadApps().map((a) => a.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
    expect(names).toEqual(expect.arrayContaining(['Mail', 'LinkedIn', 'Finder']))
    expect(names).not.toEqual(expect.arrayContaining(['TextEdit', 'Quick Look', 'Launchpad', 'About This Mac', 'Trash']))
  })

  it('gives every loadable app a window spec and every external link https', () => {
    for (const app of APPS.filter((a) => a.load)) expect(app.window, app.id).toBeDefined()
    for (const app of APPS.filter((a) => a.external)) {
      expect(new URL(app.external as string).protocol, app.id).toBe('https:')
    }
    expect(getApp('trash')?.alias).toEqual({ appId: 'finder', props: { folderId: 'trash' } })
  })

  it('marks the focused window in the Window menu and omits the empty View menu', () => {
    const windows = [win('a', 'Finder'), win('b', 'About This Mac')]
    const menus = defaultMenus({ focused: windows[1], windows, keyboardLocked: false })

    expect(menus.map((m) => m.id)).toEqual(['file', 'edit', 'window', 'help'])
    const items = menus.find((m) => m.id === 'window')?.items ?? []
    const ours = items.filter((i) => 'command' in i && i.command?.type === 'window.focus')
    expect(ours).toEqual([
      expect.objectContaining({ label: 'Finder', checked: false }),
      expect.objectContaining({ label: 'About This Mac', checked: true }),
    ])
  })

  it('resolves window specs through the store so only windowed apps open', () => {
    expect(useSystem.getState().openApp('finder')).toEqual(expect.any(String))
    expect(useSystem.getState().openApp('linkedin')).toBeNull()
  })
})
