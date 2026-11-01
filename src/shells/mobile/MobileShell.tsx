import { useEffect, useRef } from 'react'
import { getApp, mobileHomeApps } from '../../apps/registry'
import { useSystem } from '../../system/store'
import { AppScreen } from './AppScreen'
import { LockScreen } from './LockScreen'

// The home screen is temporary here; the next task replaces it.
export function MobileShell() {
  const locked = useSystem((s) => s.locked)
  const home = useSystem((s) => s.mobileHome)
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const focusedId = useSystem((s) => s.wm.focusedId)
  const focused = useSystem((s) => s.wm.windows.find((w) => w.id === focusedId))
  const homeRef = useRef<HTMLDivElement>(null)
  const leftHome = useRef(false)
  const wasLocked = useRef(locked)
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

  // Unlocking to home focuses its first app button; the lock screen had no home focus to hand over.
  useEffect(() => {
    if (wasLocked.current && !locked && showHome) homeRef.current?.querySelector('button')?.focus()
    wasLocked.current = locked
  }, [locked, showHome])

  if (locked) return <LockScreen />


  return (
    <div className="relative h-full w-full overflow-hidden">
      {(showHome || sheet) && (
        <div
          ref={homeRef}
          aria-hidden={showHome ? undefined : 'true'}
          inert={!showHome}
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
