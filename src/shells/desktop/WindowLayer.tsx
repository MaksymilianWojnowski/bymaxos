import {
  lazy,
  Suspense,
  useReducer,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'
import { getApp } from '../../apps/registry'
import type { AppDefinition, AppProps } from '../../apps/types'
import { useSystem } from '../../system/store'
import type { AppId } from '../../system/types'
import { AppErrorBoundary } from './AppErrorBoundary'
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
  // A reset drops the cached lazy component; this re-render makes the window pick up the fresh one.
  const [, rerender] = useReducer((n: number) => n + 1, 0)

  return (
    <div className="pointer-events-none absolute inset-0 isolate">
      {windows
        .filter((win) => win.mode !== 'minimized')
        .map((win) => {
          const app = getApp(win.appId)
          const load = app?.load
          if (!app || !load || !app.window) return null
          const App = componentFor(app, load)
          return (
            <Window key={win.id} win={win} app={app} focused={win.id === focusedId}>
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
