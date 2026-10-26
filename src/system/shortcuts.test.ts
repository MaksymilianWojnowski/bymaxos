import { describe, expect, it } from 'vitest'
import { isTextField, matchShortcut, shortcutLabel, type KeyLike } from './shortcuts'

const NONE = { inTextField: false, keyboardLocked: false }

function key(code: string, mods: Partial<KeyLike> = {}): KeyLike {
  return {
    code,
    key: '',
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  }
}

describe('matchShortcut', () => {
  it('matches an Option shortcut by code, since macOS changes the key value', () => {
    expect(matchShortcut({ ...key('KeyW', { altKey: true }), key: '∑' }, NONE)).toEqual({
      type: 'window.close',
    })
  })

  it('ignores a plain Option shortcut inside a text field, but keeps Escape and Command shortcuts', () => {
    const inField = { inTextField: true, keyboardLocked: false }
    expect(matchShortcut(key('KeyW', { altKey: true }), inField)).toBeNull()
    expect(matchShortcut(key('Escape'), inField)).toEqual({ type: 'overlay.close' })
    expect(matchShortcut(key('KeyK', { metaKey: true }), inField)).toEqual({
      type: 'overlay.open',
      overlay: 'spotlight',
    })
  })

  it('matches Command shortcuts only when the keyboard is locked', () => {
    expect(matchShortcut(key('KeyW', { metaKey: true }), NONE)).toBeNull()
    expect(
      matchShortcut(key('KeyW', { metaKey: true }), { inTextField: false, keyboardLocked: true }),
    ).toEqual({ type: 'window.close' })
  })

  it('requires the exact modifier set', () => {
    expect(matchShortcut(key('KeyW', { altKey: true, shiftKey: true }), NONE)).toBeNull()
    expect(matchShortcut(key('KeyW', { altKey: true, ctrlKey: true }), NONE)).toBeNull()
    expect(matchShortcut(key('Escape', { shiftKey: true }), NONE)).toBeNull()
  })

  it('maps Option-Up to Mission Control and Option-digits to view commands', () => {
    expect(matchShortcut(key('ArrowUp', { altKey: true }), NONE)).toEqual({
      type: 'overlay.open',
      overlay: 'missionControl',
    })
    expect(matchShortcut(key('Digit2', { altKey: true }), NONE)).toEqual({ type: 'view.list' })
  })
})

describe('shortcutLabel', () => {
  it('shows the Option label normally and the Command label when the keyboard is locked', () => {
    expect(shortcutLabel('window.close', false)).toBe('⌥W')
    expect(shortcutLabel('window.close', true)).toBe('⌘W')
  })

  it('falls back to the always-on label for commands with no locked variant', () => {
    expect(shortcutLabel('overlay.close', true)).toBe('Esc')
  })

  it('returns undefined for a command with no shortcut', () => {
    expect(shortcutLabel('system.lock', false)).toBeUndefined()
  })
})

describe('isTextField', () => {
  it('recognises text-like inputs, textareas and contenteditable elements', () => {
    const input = (type?: string): HTMLInputElement => {
      const el = document.createElement('input')
      if (type) el.type = type
      return el
    }
    expect(isTextField(input())).toBe(true)
    expect(isTextField(input('search'))).toBe(true)
    expect(isTextField(input('password'))).toBe(true)
    expect(isTextField(input('checkbox'))).toBe(false)

    expect(isTextField(document.createElement('textarea'))).toBe(true)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    expect(isTextField(editable)).toBe(true)

    expect(isTextField(document.createElement('button'))).toBe(false)
    expect(isTextField(null)).toBe(false)
  })
})
