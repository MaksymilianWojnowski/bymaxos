import {
  lazy,
  Suspense,
  useReducer,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { getApp } from '../../apps/registry'
import type { AppDefinition, AppProps } from '../../apps/types'
import { getWorkArea } from '../../system/layout'
import { missionLayout } from '../../system/missionLayout'
import { useSystem } from '../../system/store'
import type { AppId } from '../../system/types'
import { AppErrorBoundary } from './AppErrorBoundary'
import { MissionControl } from './MissionControl'
import { Window } from './Window'

// One lazy component per app, so re-rendering a window never remounts another window's app.
const components = new Map<AppId, LazyExoticComponent<ComponentType<AppProps>>>()

function componentFor(app: AppDefinition, load: NonNullable<AppDefinition['load']>) {
  let component = components.get(app.id)
  if (!component) {
    component = lazy(load)
    components.set(app.id, component)
  }
  return component
}

export function WindowLayer() {
  const windows = useSystem((s) => s.wm.windows)
  const focusedId = useSystem((s) => s.wm.focusedId)
  const overlay = useSystem((s) => s.overlay)
  const viewport = useSystem((s) => s.viewport)
  const focus = useSystem((s) => s.focus)
  const setOverlay = useSystem((s) => s.setOverlay)
  // A reset drops the cached lazy component; this re-render makes the window pick up the fresh one.
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  // Mission Control lays out every open window, back to front, over the work area.
  // Rendering keeps the store order: a DOM reorder on each focus change would blur inputs inside windows.
  const visible = windows.filter((win) => win.mode !== 'minimized')
  const byZ = [...visible].sort((a, b) => a.z - b.z)
  const missionRects =
    overlay === 'missionControl'
      ? missionLayout(
          byZ.map((win) => ({ id: win.id, w: win.rect.w, h: win.rect.h })),
          getWorkArea(viewport.w, viewport.h),
        )
      : null

  return (
    <div className="pointer-events-none absolute inset-0 isolate">
      {missionRects && (
        <MissionControl
          labels={byZ.map((win) => ({ id: win.id, title: win.title, rect: missionRects[win.id] }))}
        />
      )}
      {visible.map((win) => {
        const app = getApp(win.appId)
        const load = app?.load
        if (!app || !load || !app.window) return null
        const App = componentFor(app, load)
        const mission = missionRects
          ? {
              target: missionRects[win.id],
              onPick: () => {
                focus(win.id)
                setOverlay(null)
              },
            }
          : undefined
        return (
          <Window key={win.id} win={win} app={app} focused={win.id === focusedId} mission={mission}>
            <AppErrorBoundary
              appName={app.name}
              onReset={() => {
                components.delete(app.id)
                rerender()
              }}
            >
              <Suspense fallback={null}>
                <App windowId={win.id} props={win.props} />
              </Suspense>
            </AppErrorBoundary>
          </Window>
        )
      })}
    </div>
  )
}
