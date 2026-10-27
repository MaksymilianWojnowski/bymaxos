import type { AppDefinition } from '../../apps/types'
import type { AppId, WMState } from '../../system/types'
import { topWindowOfApp } from '../../system/wm'

export type DockAction =
  | { type: 'open' }
  | { type: 'focus'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'external'; url: string }
  | { type: 'alias'; appId: AppId; props?: Record<string, unknown> }

export function dockClickAction(wm: WMState, app: AppDefinition): DockAction {
  if (app.external) return { type: 'external', url: app.external }
  if (app.alias) return { type: 'alias', appId: app.alias.appId, props: app.alias.props }
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
