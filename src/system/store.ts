import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { getWorkArea } from './layout'
import { ACCENTS, applyAppearance, defaultSettings, type Settings } from './settings'
import { KEYS, safeStorage } from './storage'
import { runningAppsByRecency } from './switcher'
import * as wm from './wm'
import type { AppId, Rect, Size, WindowSpec, WMState } from './types'

export type Overlay =
  | null
  | 'controlCenter'
  | 'shortcuts'
  | 'spotlight'
  | 'launchpad'
  | 'missionControl'
  | 'notificationCenter'
  | 'appSwitcher'

export const AVAILABLE_OVERLAYS = new Set<Exclude<Overlay, null>>([
  'controlCenter',
  'shortcuts',
  'spotlight',
  'launchpad',
  'missionControl',
  'notificationCenter',
  'appSwitcher',
])

export interface Banner {
  id: string
  title: string
  body?: string
}

const MAX_BANNERS = 3
let bannerSeq = 0

interface SystemData {
  wm: WMState
  viewport: Size
  locked: boolean
  overlay: Overlay
  openMenuId: string | null
  settings: Settings
  keyboardLocked: boolean
  selectedDesktopIcon: string | null
  banners: Banner[]
  // The app list is a snapshot taken when the switcher opens, so stepping does not reorder it.
  switcher: { appIds: AppId[]; index: number } | null
}

export interface SystemState extends SystemData {
  notify(title: string, body?: string): string
  dismissBanner(id: string): void
  setViewport(w: number, h: number): void
  openApp(appId: AppId, props?: Record<string, unknown>): string | null
  focus(id: string): void
  close(id: string): void
  quitApp(appId: AppId): void
  minimize(id: string): void
  restore(id: string): void
  toggleMaximize(id: string): void
  move(id: string, x: number, y: number): void
  setRect(id: string, r: Rect): void
  setTitle(id: string, t: string): void
  blurWindows(): void
  unlock(): void
  lock(): void
  setOverlay(o: Overlay): void
  setOpenMenu(id: string | null): void
  updateSettings(p: Partial<Settings>): void
  setKeyboardLocked(v: boolean): void
  selectDesktopIcon(id: string | null): void
  switcherStep(dir: 1 | -1): void
  switcherCommit(index?: number): void
}

const DARK_QUERY = '(prefers-color-scheme: dark)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function matches(query: string): boolean {
  return window.matchMedia(query).matches
}

// Stored settings may be garbage from an older build or another tab: merge only a plain object.
function initialData(): SystemData {
  const viewport = { w: window.innerWidth, h: window.innerHeight }
  const defaults = defaultSettings({ prefersReducedMotion: matches(REDUCED_MOTION_QUERY) })
  const stored = safeStorage.get<unknown>('local', KEYS.settings, null)
  const merged =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? { ...defaults, ...stored }
      : defaults
  const settings = ACCENTS.includes(merged.accent) ? merged : { ...merged, accent: defaults.accent }
  const saved = safeStorage.get<unknown>('session', KEYS.windows, null)
  const hydrated = wm.hydrate(saved, getWorkArea(viewport.w, viewport.h))
  return {
    wm: { ...wm.emptyWM, ...hydrated },
    viewport,
    locked: safeStorage.get<unknown>('session', KEYS.unlocked, false) !== true,
    overlay: null,
    openMenuId: null,
    settings,
    keyboardLocked: false,
    selectedDesktopIcon: null,
    banners: [],
    switcher: null,
  }
}

// Same choice as the Dock: the app's top visible window gets focus, else its top minimized window is restored.
function activateApp(s: WMState, appId: AppId): WMState {
  const visible = wm.topWindowOfApp(s, appId)
  if (visible) return wm.focusWindow(s, visible.id)
  const minimized = wm.topWindowOfApp(s, appId, true)
  return minimized ? wm.restoreWindow(s, minimized.id) : s
}

let appResolver: (id: AppId) => WindowSpec | undefined = () => undefined

// Zoom is offered only where the window's app allows resizing (About This Mac does not).
export function isResizable(id: string): boolean {
  const win = useSystem.getState().wm.windows.find((w) => w.id === id)
  return win !== undefined && appResolver(win.appId)?.resizable === true
}

export function setAppResolver(fn: (id: AppId) => WindowSpec | undefined): void {
  appResolver = fn
}

function persistLastRects(state: WMState): void {
  safeStorage.set('session', KEYS.windows, state.lastRectByApp)
}

const initial = initialData()
applyAppearance(initial.settings, matches(DARK_QUERY))

export const useSystem: UseBoundStore<StoreApi<SystemState>> = create<SystemState>()((set, get) => {
  const area = (): Rect => {
    const { w, h } = get().viewport
    return getWorkArea(w, h)
  }

  return {
    ...initial,

    setViewport(w, h) {
      set({ viewport: { w, h }, wm: wm.clampAll(get().wm, getWorkArea(w, h)) })
    },

    openApp(appId, props) {
      const spec = appResolver(appId)
      if (!spec) return null
      const next = wm.openWindow(get().wm, spec, area(), props)
      set({ wm: next })
      return next.focusedId
    },

    focus(id) {
      set({ wm: wm.focusWindow(get().wm, id) })
    },

    close(id) {
      const next = wm.closeWindow(get().wm, id)
      set({ wm: next })
      persistLastRects(next)
    },

    quitApp(appId) {
      const next = wm.closeApp(get().wm, appId)
      set({ wm: next })
      persistLastRects(next)
    },

    minimize(id) {
      set({ wm: wm.minimizeWindow(get().wm, id) })
    },

    restore(id) {
      set({ wm: wm.restoreWindow(get().wm, id) })
    },

    toggleMaximize(id) {
      if (!isResizable(id)) return
      set({ wm: wm.toggleMaximize(get().wm, id, area()) })
    },

    move(id, x, y) {
      set({ wm: wm.moveWindow(get().wm, id, x, y, area()) })
    },

    setRect(id, r) {
      const { wm: state } = get()
      const win = state.windows.find((w) => w.id === id)
      const minSize = (win && appResolver(win.appId)?.minSize) ?? { w: 0, h: 0 }
      set({ wm: wm.setWindowRect(state, id, r, minSize, area()) })
    },

    setTitle(id, t) {
      set({ wm: wm.setWindowTitle(get().wm, id, t) })
    },

    blurWindows() {
      set((s) => ({ wm: { ...s.wm, focusedId: null } }))
    },

    unlock() {
      set({ locked: false })
      safeStorage.set('session', KEYS.unlocked, true)
    },

    lock() {
      set({ locked: true })
      safeStorage.set('session', KEYS.unlocked, false)
    },

    setOverlay(o) {
      set({ overlay: o, switcher: o === 'appSwitcher' ? get().switcher : null })
    },

    setOpenMenu(id) {
      set({ openMenuId: id })
    },

    updateSettings(p) {
      const settings = { ...get().settings, ...p }
      set({ settings })
      safeStorage.set('local', KEYS.settings, settings)
      applyAppearance(settings, matches(DARK_QUERY))
    },

    setKeyboardLocked(v) {
      set({ keyboardLocked: v })
    },

    selectDesktopIcon(id) {
      set({ selectedDesktopIcon: id })
    },

    switcherStep(dir) {
      const { switcher } = get()
      if (switcher) {
        const n = switcher.appIds.length
        set({ switcher: { ...switcher, index: (switcher.index + dir + n) % n } })
        return
      }
      const { wm: state } = get()
      const appIds = runningAppsByRecency(state)
      const n = appIds.length
      if (n === 0) return
      // Opening starts from index 0, so the first step lands on the second app (or the last, going back).
      // With nothing focused and no Finder window leading, index 0 is the top app, so the first step lands there.
      const topIsNotActive = state.focusedId === null && appIds[0] !== 'finder'
      const index = dir === 1 && topIsNotActive ? 0 : (dir + n) % n
      set({ overlay: 'appSwitcher', switcher: { appIds, index } })
    },

    switcherCommit(index) {
      const { switcher } = get()
      if (!switcher) return
      const appId = switcher.appIds[index ?? switcher.index]
      set({ wm: activateApp(get().wm, appId), overlay: null, switcher: null })
    },

    notify(title, body) {
      const id = `banner-${++bannerSeq}`
      set((s) => ({ banners: [...s.banners, { id, title, body }].slice(-MAX_BANNERS) }))
      return id
    },

    dismissBanner(id) {
      set((s) => ({ banners: s.banners.filter((b) => b.id !== id) }))
    },
  }
})

// Follow the OS colour scheme live while the appearance setting is 'auto'.
window
  .matchMedia(DARK_QUERY)
  .addEventListener('change', (e) => applyAppearance(useSystem.getState().settings, e.matches))

// Test helper: fresh state computed from storage, as on a page load.
export function resetSystem(): void {
  const data = initialData()
  applyAppearance(data.settings, matches(DARK_QUERY))
  useSystem.setState(data)
}
