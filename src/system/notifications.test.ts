import { beforeEach, describe, expect, it } from 'vitest'
import { readDismissed, saveDismissed } from './notifications'
import { KEYS } from './storage'

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('dismissed notifications', () => {
  it('reads nothing dismissed when nothing is stored', () => {
    expect(readDismissed()).toEqual([])
  })

  it('round-trips the saved ids through session storage', () => {
    saveDismissed(['welcome', 'github'])
    expect(readDismissed()).toEqual(['welcome', 'github'])
  })

  it('treats a stored value that is not a list of strings as nothing dismissed', () => {
    window.sessionStorage.setItem(KEYS.notifications, JSON.stringify({ welcome: true }))
    expect(readDismissed()).toEqual([])
    window.sessionStorage.setItem(KEYS.notifications, JSON.stringify(['welcome', 3]))
    expect(readDismissed()).toEqual([])
  })
})
