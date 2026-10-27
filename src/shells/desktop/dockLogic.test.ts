import { describe, expect, it } from 'vitest'
import { getApp } from '../../apps/registry'
import { getContent } from '../../content'
import { emptyWM } from '../../system/wm'
import type { WindowState, WMState } from '../../system/types'
import { dockClickAction, magnifyScale } from './dockLogic'

const win = (id: string, appId: string, z: number, mode: WindowState['mode'] = 'normal'): WindowState => ({
  id,
  appId,
  title: appId,
  rect: { x: 0, y: 0, w: 100, h: 100 },
  mode,
  z,
})
const withWindows = (...windows: WindowState[]): WMState => ({ ...emptyWM, windows })

describe('dockClickAction', () => {
  const finder = getApp('finder')!

  it('opens the app when it has no windows', () => {
    expect(dockClickAction(emptyWM, finder)).toEqual({ type: 'open' })
    expect(dockClickAction(withWindows(win('w1', 'about', 1)), finder)).toEqual({ type: 'open' })
  })

  it('focuses the only normal window of the app', () => {
    expect(dockClickAction(withWindows(win('w1', 'finder', 1)), finder)).toEqual({
      type: 'focus',
      id: 'w1',
    })
  })

  it('restores the app when every window is minimized', () => {
    expect(dockClickAction(withWindows(win('w1', 'finder', 1, 'minimized')), finder)).toEqual({
      type: 'restore',
      id: 'w1',
    })
  })

  it('focuses the normal window over a minimized one', () => {
    const wm = withWindows(win('w1', 'finder', 5, 'minimized'), win('w2', 'finder', 1))
    expect(dockClickAction(wm, finder)).toEqual({ type: 'focus', id: 'w2' })
  })

  it('opens external links in a new tab', () => {
    const url = getContent().links.find((l) => l.id === 'linkedin')!.url
    expect(dockClickAction(emptyWM, getApp('linkedin')!)).toEqual({ type: 'external', url })
  })

  it('an overlay app opens its overlay', () => {
    expect(dockClickAction(emptyWM, getApp('launchpad')!)).toEqual({ type: 'overlay', overlay: 'launchpad' })
  })

  it('resolves the trash alias to its target app and props', () => {
    expect(dockClickAction(emptyWM, getApp('trash')!)).toEqual({
      type: 'alias',
      appId: 'finder',
      props: { folderId: 'trash' },
    })
  })

  describe('alias activation', () => {
    const trash = getApp('trash')!
    const trashWin = (id: string, z: number, mode: WindowState['mode'] = 'normal'): WindowState => ({
      ...win(id, 'finder', z, mode),
      props: { folderId: 'trash' },
    })

    it('focuses the top visible window showing the same props', () => {
      const wm = withWindows(trashWin('t1', 1), trashWin('t2', 4), win('f1', 'finder', 9))
      expect(dockClickAction(wm, trash)).toEqual({ type: 'focus', id: 't2' })
    })

    it('restores a minimized window with the same props', () => {
      expect(dockClickAction(withWindows(trashWin('t1', 1, 'minimized')), trash)).toEqual({
        type: 'restore',
        id: 't1',
      })
    })

    it('ignores finder windows whose props differ', () => {
      expect(dockClickAction(withWindows(win('f1', 'finder', 1)), trash)).toEqual({
        type: 'alias',
        appId: 'finder',
        props: { folderId: 'trash' },
      })
    })
  })
})

describe('magnifyScale', () => {
  it('peaks at the maximum under the pointer', () => {
    expect(magnifyScale(0)).toBe(1.6)
  })

  it('returns to 1 at and beyond the range', () => {
    expect(magnifyScale(120)).toBe(1)
    expect(magnifyScale(200)).toBe(1)
  })

  it('shrinks the boost as distance grows', () => {
    expect(magnifyScale(30)).toBeGreaterThan(magnifyScale(60))
  })
})
