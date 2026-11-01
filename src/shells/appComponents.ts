import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { AppDefinition, AppProps } from '../apps/types'
import type { AppId } from '../system/types'

// One lazy component per app, so re-rendering a window never remounts another window's app.
const components = new Map<AppId, LazyExoticComponent<ComponentType<AppProps>>>()

export function componentFor(
  app: AppDefinition,
): LazyExoticComponent<ComponentType<AppProps>> | null {
  const load = app.load
  if (!load) return null
  let component = components.get(app.id)
  if (!component) {
    component = lazy(load)
    components.set(app.id, component)
  }
  return component
}

// A crashed app drops its cached component, so the next render loads a fresh one.
export function resetComponent(appId: AppId): void {
  components.delete(appId)
}
