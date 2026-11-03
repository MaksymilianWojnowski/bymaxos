import { useEffect, useRef, useState } from 'react'
import { getApp } from '../../apps/registry'
import { registerGlobal } from '../../system/commands'
import { takeDeepLink } from '../../system/shell'
import { useSystem } from '../../system/store'
import type { AppId } from '../../system/types'
import { AppScreen } from './AppScreen'
import { HomeScreen } from './HomeScreen'
import { LockScreen } from './LockScreen'
import { MobileSearch } from './MobileSearch'

export function MobileShell() {
  const locked = useSystem((s) => s.locked)
  const home = useSystem((s) => s.mobileHome)
  const focusedId = useSystem((s) => s.wm.focusedId)
  const focused = useSystem((s) => s.wm.windows.find((w) => w.id === focusedId))
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const homeRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const leftHome = useRef(false)
  const wasLocked = useRef(locked)
  const seenFocus = useRef<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  // Resume's Email sends app.open and Terminal's `open` sends dock.activate; both take the mobile rules, not the desktop ones.
  useEffect(() => {
    const disposeOpen = registerGlobal('app.open', (cmd) => {
      if (typeof cmd.appId === 'string') openMobileApp(cmd.appId as AppId, cmd.props as Record<string, unknown> | undefined)
    })
    const disposeActivate = registerGlobal('dock.activate', (cmd) => {
      if (typeof cmd.appId === 'string') openMobileApp(cmd.appId as AppId)
    })
    return () => {
      disposeOpen()
      disposeActivate()
    }
  }, [openMobileApp])

  // A focused window at mount (a switch from the desktop shell) or one that takes focus later brings its app forward,
  // unless the user went home from that same window: a shell switch from home stays home.
  useEffect(() => {
    const homeFocus = useSystem.getState().mobileHomeFocus
    if (focusedId && focusedId !== seenFocus.current && focusedId !== homeFocus) useSystem.setState({ mobileHome: false })
    seenFocus.current = focusedId
  }, [focusedId])

  // iOS keeps 100dvh at full height when the keyboard opens, so the shell follows the visual viewport instead.
  useEffect(() => {
    const vv = window.visualViewport
    const el = rootRef.current
    if (!vv || !el) return
    // Pinch-zoom also changes the visual viewport; above scale 1 the shell keeps its height.
    const fit = () => {
      if (vv.scale > 1.01) return
      el.style.height = `${vv.height}px`
      window.scrollTo(0, 0)
    }
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
      el.style.height = ''
    }
  }, [locked])

  // A deep link waits for unlock, so it opens after the lock screen is gone.
  useEffect(() => {
    if (locked) return
    const link = takeDeepLink()
    if (link) openMobileApp(link.appId, link.item ? { item: link.item } : undefined)
  }, [locked, openMobileApp])

  const showHome = home || !focused
  const sheet = !showHome && focused && getApp(focused.appId)?.mobile?.presentation === 'sheet'
  // Search covers the home screen, so its controls leave the tab order while it is open.
  const homeInert = !showHome || searchOpen

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
    <div ref={rootRef} className="relative h-full w-full overflow-hidden">
      {(showHome || sheet) && (
        <div
          ref={homeRef}
          aria-hidden={homeInert ? 'true' : undefined}
          inert={homeInert}
          className="absolute inset-0"
        >
          <HomeScreen onSearch={() => setSearchOpen(true)} />
        </div>
      )}
      <AppScreen />
      {searchOpen && <MobileSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
