import { useEffect, useRef, useState } from 'react'
import { getApp } from '../../apps/registry'
import { useSystem } from '../../system/store'
import { AppScreen } from './AppScreen'
import { HomeScreen } from './HomeScreen'
import { LockScreen } from './LockScreen'

export function MobileShell() {
  const locked = useSystem((s) => s.locked)
  const home = useSystem((s) => s.mobileHome)
  const focusedId = useSystem((s) => s.wm.focusedId)
  const focused = useSystem((s) => s.wm.windows.find((w) => w.id === focusedId))
  const homeRef = useRef<HTMLDivElement>(null)
  const leftHome = useRef(false)
  const wasLocked = useRef(locked)
  const seenFocus = useRef<string | null>(null)
  // Search UI arrives with the search task; until then opening it changes no visible state.
  const [, setSearchOpen] = useState(false)

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
          className="absolute inset-0"
        >
          <HomeScreen onSearch={() => setSearchOpen(true)} />
        </div>
      )}
      {!showHome && <AppScreen />}
    </div>
  )
}
