import { useEffect } from 'react'
import { dispatch, installSystemCommands } from '../../system/commands'
import { isTextField, matchShortcut } from '../../system/shortcuts'
import { parseDeepLink } from '../../system/shell'
import { useSystem } from '../../system/store'
import { Desktop } from './Desktop'
import { Dock } from './Dock'
import { LoginScreen } from './LoginScreen'
import { MenuBar } from './MenuBar'
import { Wallpaper } from './Wallpaper'
import { WindowLayer } from './WindowLayer'

// Module scope: a shell remount must not reopen the deep-linked app.
let deepLinkHandled = false

export function DesktopShell() {
  const locked = useSystem((s) => s.locked)
  const setViewport = useSystem((s) => s.setViewport)
  const openApp = useSystem((s) => s.openApp)
  const unlock = useSystem((s) => s.unlock)
  const keyboardLocked = useSystem((s) => s.keyboardLocked)
  const sheetOpen = useSystem((s) => s.overlay === 'shortcuts')

  useEffect(() => installSystemCommands(), [])

  useEffect(() => {
    if (locked) return
    const onKey = (e: KeyboardEvent) => {
      // A modal sheet owns the keyboard; only its Escape handler (in Sheet) may act.
      if (sheetOpen && e.key !== 'Escape') return
      const cmd = matchShortcut(e, {
        inTextField: isTextField(document.activeElement),
        keyboardLocked,
      })
      if (cmd && dispatch(cmd)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [locked, keyboardLocked, sheetOpen])

  useEffect(() => {
    // The viewport may have changed while the mobile shell was mounted.
    setViewport(window.innerWidth, window.innerHeight)
    const onResize = () => setViewport(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setViewport])

  useEffect(() => {
    if (locked || deepLinkHandled) return
    deepLinkHandled = true
    const link = parseDeepLink(window.location.search)
    if (link) openApp(link.appId, link.item ? { item: link.item } : undefined)
  }, [locked, openApp])

  if (locked) return <LoginScreen onUnlock={unlock} />

  return (
    <div data-testid="desktop" className="relative h-full w-full">
      <Wallpaper />
      <Desktop />
      <WindowLayer />
      <MenuBar />
      <Dock />
    </div>
  )
}
