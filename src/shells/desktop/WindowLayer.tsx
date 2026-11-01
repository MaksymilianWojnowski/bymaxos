import { Suspense, useReducer } from 'react'
import { getApp } from '../../apps/registry'
import { getWorkArea } from '../../system/layout'
import { missionLayout } from '../../system/missionLayout'
import { useSystem } from '../../system/store'
import { componentFor, resetComponent } from '../appComponents'
import { AppErrorBoundary } from './AppErrorBoundary'
import { MissionControl } from './MissionControl'
import { Window } from './Window'

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
        const App = app && componentFor(app)
        if (!app || !App || !app.window) return null
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
                resetComponent(app.id)
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
