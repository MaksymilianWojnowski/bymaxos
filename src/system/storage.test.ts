import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KEYS, safeStorage } from './storage'

type AreaName = 'localStorage' | 'sessionStorage'

// Save the original descriptor so the denied-access overrides can be undone.
const originalDescriptors = new Map<AreaName, PropertyDescriptor | undefined>()

function denyAccess(name: AreaName): void {
  if (!originalDescriptors.has(name)) {
    originalDescriptors.set(name, Object.getOwnPropertyDescriptor(window, name))
  }
  Object.defineProperty(window, name, {
    configurable: true,
    get() {
      throw new Error('denied')
    },
  })
}

function restoreAccess(): void {
  for (const [name, descriptor] of originalDescriptors) {
    if (descriptor) {
      Object.defineProperty(window, name, descriptor)
    } else {
      delete (window as unknown as Record<string, unknown>)[name]
    }
  }
  originalDescriptors.clear()
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  restoreAccess()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('safeStorage', () => {
  it('returns the fallback when the key is missing', () => {
    expect(safeStorage.get('local', 'missing', { a: 1 })).toEqual({ a: 1 })
  })

  it('round-trips an object through local storage', () => {
    safeStorage.set('local', KEYS.settings, { dockSize: 52, dark: true })
    expect(safeStorage.get('local', KEYS.settings, null)).toEqual({ dockSize: 52, dark: true })
  })

  it('keeps local and session areas separate', () => {
    safeStorage.set('session', KEYS.unlocked, true)
    expect(safeStorage.get('session', KEYS.unlocked, false)).toBe(true)
    expect(safeStorage.get('local', KEYS.unlocked, false)).toBe(false)
  })

  it('returns the fallback when the stored value is invalid JSON', () => {
    window.localStorage.setItem(KEYS.windows, '{not json')
    expect(safeStorage.get('local', KEYS.windows, ['fallback'])).toEqual(['fallback'])
  })

  it('returns the fallback when the stored JSON parses to null', () => {
    window.sessionStorage.setItem(KEYS.icons, 'null')
    expect(safeStorage.get('session', KEYS.icons, [1, 2])).toEqual([1, 2])
  })

  it('removes a stored key', () => {
    safeStorage.set('local', KEYS.settings, 'x')
    safeStorage.remove('local', KEYS.settings)
    expect(window.localStorage.getItem(KEYS.settings)).toBeNull()
  })

  it('returns the fallback and does not throw when local storage access is denied', () => {
    denyAccess('localStorage')
    expect(() => safeStorage.get('local', KEYS.settings, 'fallback')).not.toThrow()
    expect(safeStorage.get('local', KEYS.settings, 'fallback')).toBe('fallback')
  })

  it('does not throw when set or remove are denied', () => {
    denyAccess('localStorage')
    expect(() => safeStorage.set('local', KEYS.settings, { a: 1 })).not.toThrow()
    expect(() => safeStorage.remove('local', KEYS.settings)).not.toThrow()
  })

  it('returns the fallback and does not throw when session storage access is denied', () => {
    denyAccess('sessionStorage')
    expect(safeStorage.get('session', KEYS.unlocked, false)).toBe(false)
    expect(() => safeStorage.set('session', KEYS.unlocked, true)).not.toThrow()
    expect(() => safeStorage.remove('session', KEYS.unlocked)).not.toThrow()
  })
})
