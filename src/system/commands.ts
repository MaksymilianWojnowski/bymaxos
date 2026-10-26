import { useEffect, useLayoutEffect, useRef } from 'react'
import { KEYS, safeStorage } from './storage'
import { AVAILABLE_OVERLAYS, useSystem, type Overlay } from './store'
import { activeAppId, emptyWM, raiseAppWindows } from './wm'

export type Command = { type: string; [key: string]: unknown }
export type Handler = (cmd: Command) => void
export type HandlerRecord = Record<string, Handler>

interface GlobalEntry {
  handler: Handler
  enabled?: (cmd: Command) => boolean
}

// Global names never collide with window command names, so a global always wins a lookup.
const globals = new Map<string, GlobalEntry>()
// A getter, not a snapshot: a window's command set can change between renders.
const windowHandlers = new Map<string, () => HandlerRecord>()

export function registerGlobal(
  type: string,
  handler: Handler,
  enabled?: (cmd: Command) => boolean,
): () => void {
  const entry: GlobalEntry = { handler, enabled }
  globals.set(type, entry)
  return () => {
    if (globals.get(type) === entry) globals.delete(type)
  }
}

export function registerWindowHandlers(
  windowId: string,
  source: HandlerRecord | (() => HandlerRecord),
): () => void {
  const get = typeof source === 'function' ? source : () => source
  windowHandlers.set(windowId, get)
  return () => {
    if (windowHandlers.get(windowId) === get) windowHandlers.delete(windowId)
  }
}

// Test helper: drops every registration.
export function resetCommands(): void {
  globals.clear()
  windowHandlers.clear()
}

// A disabled global does not fall through to the focused window.
function resolve(cmd: Command): Handler | undefined {
  const entry = globals.get(cmd.type)
  if (entry) return (entry.enabled?.(cmd) ?? true) ? entry.handler : undefined
  const id = useSystem.getState().wm.focusedId
  const handlers = id === null ? undefined : windowHandlers.get(id)?.()
  return handlers && Object.hasOwn(handlers, cmd.type) ? handlers[cmd.type] : undefined
}

export function canDispatch(cmd: Command): boolean {
  return resolve(cmd) !== undefined
}

export function dispatch(cmd: Command): boolean {
  const handler = resolve(cmd)
  if (!handler) return false
  handler(cmd)
  return true
}

// Keys and bodies both follow the latest render; the registration happens once per windowId.
export function useWindowCommands(windowId: string, handlers: HandlerRecord): void {
  const latest = useRef(handlers)
  // Layout effect: the ref is current before paint and before any dispatch, and lint forbids writing it during render.
  useLayoutEffect(() => {
    latest.current = handlers
  })
  useEffect(() => registerWindowHandlers(windowId, () => latest.current), [windowId])
}

const state = () => useSystem.getState()
const focusedId = (): string | null => state().wm.focusedId
const hasFocus = (): boolean => focusedId() !== null
const onFocused =
  (fn: (id: string) => void): Handler =>
  () => {
    const id = focusedId()
    if (id !== null) fn(id)
  }

// Commands without an explicit appId act on the app of the focused window.
const targetApp = (cmd: Command): string =>
  typeof cmd.appId === 'string' ? cmd.appId : activeAppId(state().wm)
const hasWindowsOf = (cmd: Command): boolean =>
  state().wm.windows.some((w) => w.appId === targetApp(cmd))

// Raise is possible when a visible window of the active app sits below a visible window of another app.
const canRaiseActiveApp = (): boolean => {
  const { wm } = state()
  const app = activeAppId(wm)
  const visible = (w: { mode: string }) => w.mode !== 'minimized'
  const mine = wm.windows.filter((w) => w.appId === app && visible(w))
  if (mine.length === 0) return false
  const lowest = Math.min(...mine.map((w) => w.z))
  return wm.windows.some((w) => w.appId !== app && visible(w) && w.z > lowest)
}

type GlobalDef = [type: string, handler: Handler, enabled?: (cmd: Command) => boolean]

const SYSTEM_GLOBALS: GlobalDef[] = [
  ['window.close', onFocused((id) => state().close(id)), hasFocus],
  ['window.minimize', onFocused((id) => state().minimize(id)), hasFocus],
  ['window.zoom', onFocused((id) => state().toggleMaximize(id)), hasFocus],
  [
    'window.focus',
    (cmd) => {
      if (typeof cmd.id === 'string') state().focus(cmd.id)
    },
  ],
  [
    'window.bringAllToFront',
    () => useSystem.setState((s) => ({ wm: raiseAppWindows(s.wm, activeAppId(s.wm)) })),
    canRaiseActiveApp,
  ],
  [
    'app.open',
    (cmd) => {
      if (typeof cmd.appId === 'string') {
        state().openApp(cmd.appId, cmd.props as Record<string, unknown> | undefined)
      }
    },
  ],
  ['app.quit', (cmd) => state().quitApp(targetApp(cmd)), hasWindowsOf],
  [
    'app.hide',
    (cmd) => {
      const appId = targetApp(cmd)
      for (const w of state().wm.windows) {
        if (w.appId === appId && w.mode !== 'minimized') state().minimize(w.id)
      }
    },
    hasWindowsOf,
  ],
  ['system.lock', () => state().lock()],
  [
    'system.restart',
    () => {
      safeStorage.remove('session', KEYS.unlocked)
      useSystem.setState({ locked: true, wm: emptyWM })
    },
  ],
  [
    'overlay.open',
    (cmd) => state().setOverlay(cmd.overlay as Overlay),
    (cmd) => AVAILABLE_OVERLAYS.has(cmd.overlay as Exclude<Overlay, null>),
  ],
  [
    'overlay.close',
    () => {
      if (state().openMenuId !== null) state().setOpenMenu(null)
      else state().setOverlay(null)
    },
    () => state().openMenuId !== null || state().overlay !== null,
  ],
]

export function installSystemCommands(): () => void {
  const disposers = SYSTEM_GLOBALS.map(([type, handler, enabled]) =>
    registerGlobal(type, handler, enabled),
  )
  return () => {
    for (const dispose of disposers) dispose()
  }
}
