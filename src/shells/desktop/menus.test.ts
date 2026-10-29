import { describe, expect, it, vi } from 'vitest'
import { getApp } from '../../apps/registry'
import type { AppDefinition, MenuContext, MenuDef } from '../../apps/types'
import { buildMenus } from './menus'

// buildMenus calls getApp once; the stub answers that call, and every other lookup keeps the real registry.
vi.mock('../../apps/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../apps/registry')>()
  return { ...actual, getApp: vi.fn(actual.getApp) }
})

const ctx: MenuContext = { focused: null, windows: [], keyboardLocked: false }

const menu = (id: string, label = id): MenuDef => ({
  id,
  label,
  items: [{ label: `${id} item`, command: { type: 'test.noop' } }],
})

// The app id is arbitrary: the stub returns this definition for the one call buildMenus makes.
function customApp(menus: (ctx: MenuContext) => MenuDef[]) {
  vi.mocked(getApp).mockImplementationOnce(
    () => ({ id: 'custom', name: 'Custom', menus }) as unknown as AppDefinition,
  )
}

const idsOf = (menus: MenuDef[]) => menus.map((m) => m.id)

describe('buildMenus', () => {
  it('starts with the system and app menus, then the defaults in fixed order', () => {
    // 'about' has no menus of its own; Finder's menus would add View and Go.
    expect(idsOf(buildMenus(ctx, 'about'))).toEqual(['system', 'app', 'file', 'edit', 'window', 'help'])
  })

  it('orders file, edit, view, go, window, help when an app supplies every known menu', () => {
    customApp(() => [menu('help'), menu('go'), menu('view'), menu('edit'), menu('file')])
    expect(idsOf(buildMenus(ctx, 'custom'))).toEqual([
      'system',
      'app',
      'file',
      'edit',
      'view',
      'go',
      'window',
      'help',
    ])
  })

  it('replaces a default menu with the same id in its original position', () => {
    customApp(() => [menu('edit', 'Edit (app)')])
    const menus = buildMenus(ctx, 'custom')
    expect(idsOf(menus)).toEqual(['system', 'app', 'file', 'edit', 'window', 'help'])
    expect(menus.find((m) => m.id === 'edit')?.label).toBe('Edit (app)')
  })

  it('inserts an unknown menu id before Window', () => {
    customApp(() => [menu('tools')])
    expect(idsOf(buildMenus(ctx, 'custom'))).toEqual([
      'system',
      'app',
      'file',
      'edit',
      'tools',
      'window',
      'help',
    ])
  })

  it('omits menus that end up with no items', () => {
    customApp(() => [{ id: 'edit', label: 'Edit', items: [] }])
    expect(idsOf(buildMenus(ctx, 'custom'))).not.toContain('edit')
  })

  it('System Settings… opens the settings app', () => {
    const items = buildMenus(ctx, 'about')[0].items
    expect(items).toContainEqual(
      expect.objectContaining({ label: 'System Settings…', command: { type: 'app.open', appId: 'settings' } }),
    )
    expect(items.find((i) => 'label' in i && i.label === 'System Settings…')).not.toHaveProperty('disabled', true)
  })
})
