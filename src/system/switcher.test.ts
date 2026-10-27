import { describe, expect, it } from 'vitest'
import { runningAppsByRecency } from './switcher'
import { emptyWM } from './wm'
import type { WindowState, WMState } from './types'

function win(id: string, appId: string, z: number, mode: WindowState['mode'] = 'normal'): WindowState {
  return { id, appId, title: id, rect: { x: 0, y: 0, w: 100, h: 100 }, mode, z }
}

function wmWith(windows: WindowState[]): WMState {
  return { ...emptyWM, windows }
}

describe('runningAppsByRecency', () => {
  it('orders apps by their highest window z, most recent first, including apps whose windows are all minimized; each app once', () => {
    const wm = wmWith([
      win('w1', 'finder', 1),
      win('w2', 'notes', 2, 'minimized'),
      win('w3', 'finder', 5),
      win('w4', 'mail', 3),
    ])
    expect(runningAppsByRecency(wm)).toEqual(['finder', 'mail', 'notes'])
  })

  it('puts the focused app first even when focus moved to a window with a lower z', () => {
    // Minimizing the focused window hands focus to a lower-z window without raising it.
    const wm = { ...wmWith([win('w1', 'finder', 1), win('w2', 'notes', 2, 'minimized')]), focusedId: 'w1' }
    expect(runningAppsByRecency(wm)).toEqual(['finder', 'notes'])
  })

  it('leads with Finder when nothing is focused and Finder has windows', () => {
    const wm = wmWith([win('w1', 'finder', 1), win('w2', 'notes', 2)])
    expect(runningAppsByRecency(wm)).toEqual(['finder', 'notes'])
  })

  it('ranks by z alone when nothing is focused and Finder has no windows', () => {
    const wm = wmWith([win('w1', 'notes', 1), win('w2', 'mail', 2)])
    expect(runningAppsByRecency(wm)).toEqual(['mail', 'notes'])
  })

  it('is empty with no windows', () => {
    expect(runningAppsByRecency(emptyWM)).toEqual([])
  })
})
