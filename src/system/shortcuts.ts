import type { Command } from './commands'

export interface KeyLike {
  code: string
  key: string
  altKey: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

// `code` and `modifier` extend the brief's shape: matching needs the physical key and the exact modifier.
export interface ShortcutDef {
  combo: string
  code: string
  modifier: 'alt' | 'meta' | null
  command: Command
  when: 'always' | 'keyboardLocked'
}

// Option variants are the default because macOS and Chrome own the Command and Control forms.
export const SHORTCUTS: ShortcutDef[] = [
  { combo: '⌥W', code: 'KeyW', modifier: 'alt', command: { type: 'window.close' }, when: 'always' },
  { combo: '⌥M', code: 'KeyM', modifier: 'alt', command: { type: 'window.minimize' }, when: 'always' },
  { combo: '⌥Q', code: 'KeyQ', modifier: 'alt', command: { type: 'app.quit' }, when: 'always' },
  {
    combo: '⌘K',
    code: 'KeyK',
    modifier: 'meta',
    command: { type: 'overlay.open', overlay: 'spotlight' },
    when: 'always',
  },
  {
    combo: '⌥↑',
    code: 'ArrowUp',
    modifier: 'alt',
    command: { type: 'overlay.open', overlay: 'missionControl' },
    when: 'always',
  },
  { combo: '⌥1', code: 'Digit1', modifier: 'alt', command: { type: 'view.icons' }, when: 'always' },
  { combo: '⌥2', code: 'Digit2', modifier: 'alt', command: { type: 'view.list' }, when: 'always' },
  { combo: '⌥N', code: 'KeyN', modifier: 'alt', command: { type: 'file.newWindow' }, when: 'always' },
  { combo: 'Esc', code: 'Escape', modifier: null, command: { type: 'overlay.close' }, when: 'always' },

  { combo: '⌘W', code: 'KeyW', modifier: 'meta', command: { type: 'window.close' }, when: 'keyboardLocked' },
  { combo: '⌘M', code: 'KeyM', modifier: 'meta', command: { type: 'window.minimize' }, when: 'keyboardLocked' },
  { combo: '⌘Q', code: 'KeyQ', modifier: 'meta', command: { type: 'app.quit' }, when: 'keyboardLocked' },
  { combo: '⌘1', code: 'Digit1', modifier: 'meta', command: { type: 'view.icons' }, when: 'keyboardLocked' },
  { combo: '⌘2', code: 'Digit2', modifier: 'meta', command: { type: 'view.list' }, when: 'keyboardLocked' },
  { combo: '⌘N', code: 'KeyN', modifier: 'meta', command: { type: 'file.newWindow' }, when: 'keyboardLocked' },
]

function modifiersMatch(modifier: ShortcutDef['modifier'], e: KeyLike): boolean {
  const alt = modifier === 'alt'
  const meta = modifier === 'meta'
  return (
    e.altKey === alt && e.metaKey === meta && !e.ctrlKey && !e.shiftKey
  )
}

export function matchShortcut(
  e: KeyLike,
  ctx: { inTextField: boolean; keyboardLocked: boolean },
): Command | null {
  for (const s of SHORTCUTS) {
    if (s.code !== e.code || !modifiersMatch(s.modifier, e)) continue
    if (s.when === 'keyboardLocked' && !ctx.keyboardLocked) continue
    // In a text field only Escape and Command shortcuts pass, so typing Option-letters still works.
    if (ctx.inTextField && s.command.type !== 'overlay.close' && s.modifier !== 'meta') continue
    return { ...s.command }
  }
  return null
}

// A bare type matches by type; a command also matches its overlay, which tells apart overlay.open entries.
function sameCommand(s: ShortcutDef, cmd: string | Command): boolean {
  if (typeof cmd === 'string') return s.command.type === cmd
  return s.command.type === cmd.type && (cmd.overlay === undefined || s.command.overlay === cmd.overlay)
}

export function shortcutLabel(cmd: string | Command, keyboardLocked: boolean): string | undefined {
  const lockedMatch = SHORTCUTS.find((s) => sameCommand(s, cmd) && s.when === 'keyboardLocked')
  if (keyboardLocked && lockedMatch) return lockedMatch.combo
  return SHORTCUTS.find((s) => sameCommand(s, cmd) && s.when === 'always')?.combo
}

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

const ARIA_MODIFIERS: Record<string, string> = { '⌥': 'Alt', '⌘': 'Meta', '⌃': 'Control', '⇧': 'Shift' }
const ARIA_KEYS: Record<string, string> = { '↑': 'ArrowUp', Esc: 'Escape' }

// Converts a menu glyph label ("⌥↑", "⌘K") to the aria-keyshortcuts format ("Alt+ArrowUp", "Meta+K").
export function ariaKeyshortcuts(label: string): string {
  const chars = [...label]
  const mods = chars.filter((c) => Object.hasOwn(ARIA_MODIFIERS, c)).map((c) => ARIA_MODIFIERS[c])
  const key = chars.filter((c) => !Object.hasOwn(ARIA_MODIFIERS, c)).join('')
  return [...mods, ARIA_KEYS[key] ?? key.toUpperCase()].join('+')
}

export function isTextField(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type)
  return (
    (el instanceof HTMLElement && el.isContentEditable) ||
    el.matches('[contenteditable]:not([contenteditable="false"])')
  )
}
