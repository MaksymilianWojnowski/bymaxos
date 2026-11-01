import { useEffect, useRef } from 'react'
import { getApp, mobileHomeApps } from '../../apps/registry'
import { useSystem } from '../../system/store'
import { AppScreen } from './AppScreen'

// The lock and home screens are temporary here; the next tasks replace them.
export function MobileShell() {
  const locked = useSystem((s) => s.locked)
  const unlock = useSystem((s) => s.unlock)
  const home = useSystem((s) => s.mobileHome)
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const focusedId = useSystem((s) => s.wm.focusedId)
  const focused = useSystem((s) => s.wm.windows.find((w) => w.id === focusedId))
  const homeRef = useRef<HTMLDivElement>(null)
  const leftHome = useRef(false)
  const seenFocus = useRef<string | null>(null)

  // A focused window at mount (a switch from the desktop shell) or one that takes focus later brings its app forward.
  useEffect(() => {
    if (focusedId && focusedId !== seenFocus.current) useSystem.setState({ mobileHome: false })
    seenFocus.current = focusedId
  }, [focusedId])

  const showHome = home || !focused
  const sheet = !showHome && focused && getApp(focused.appId)?.mobile?.presentation === 'sheet'

  // Going home moves focus to the first app button; the first render keeps focus where it is.
  useEffect(() => {
    if (!showHome) {
      leftHome.current = true
      return
    }
    if (leftHome.current) homeRef.current?.querySelector('button')?.focus()
  }, [showHome])

  if (locked) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-window">
        <button type="button" onClick={() => unlock()} className="min-h-11 min-w-11 px-4 text-text-1 underline">
          Unlock
        </button>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {(showHome || sheet) && (
        <div
          ref={homeRef}
          aria-hidden={showHome ? undefined : 'true'}
          className="absolute inset-0 overflow-auto bg-window p-4"
        >
          <ul className="flex flex-col gap-2">
            {mobileHomeApps().map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => openMobileApp(app.id)}
                  className="min-h-11 w-full text-left text-text-1"
                >
                  {app.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!showHome && <AppScreen />}
    </div>
  )
}
