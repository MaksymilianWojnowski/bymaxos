import type { AppDefinition } from '../../apps/types'
import type { AppId, WindowState, WMState } from '../../system/types'
import { topWindowOfApp } from '../../system/wm'

export type DockAction =
  | { type: 'open' }
  | { type: 'focus'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'external'; url: string }
  | { type: 'alias'; appId: AppId; props?: Record<string, unknown> }

// Every key of `props` must equal the window's prop; a window without props matches only an empty spec.
const matchesProps = (w: WindowState, props?: Record<string, unknown>): boolean =>
  !props || Object.entries(props).every(([k, v]) => w.props?.[k] === v)

function topOf(windows: WindowState[]): WindowState | undefined {
  let best: WindowState | undefined
  for (const w of windows) if (!best || w.z > best.z) best = w
  return best
}

// An alias reuses its target's window (same props) instead of opening another one.
function aliasAction(wm: WMState, alias: { appId: AppId; props?: Record<string, unknown> }): DockAction {
  const matching = wm.windows.filter((w) => w.appId === alias.appId && matchesProps(w, alias.props))
  const visible = topOf(matching.filter((w) => w.mode !== 'minimized'))
  if (visible) return { type: 'focus', id: visible.id }
  const minimized = topOf(matching)
  if (minimized) return { type: 'restore', id: minimized.id }
  return { type: 'alias', appId: alias.appId, props: alias.props }
}

export function dockClickAction(wm: WMState, app: AppDefinition): DockAction {
  if (app.external) return { type: 'external', url: app.external }
  if (app.alias) return aliasAction(wm, app.alias)
  const visible = topWindowOfApp(wm, app.id)
  if (visible) return { type: 'focus', id: visible.id }
  const minimized = topWindowOfApp(wm, app.id, true)
  if (minimized) return { type: 'restore', id: minimized.id }
  return { type: 'open' }
}

// Cosine falloff: the peak `max` under the pointer, back to 1 at `range` px away.
export function magnifyScale(distance: number, max = 1.6, range = 120): number {
  if (distance >= range) return 1
  return 1 + ((max - 1) * (Math.cos((distance / range) * Math.PI) + 1)) / 2
}
