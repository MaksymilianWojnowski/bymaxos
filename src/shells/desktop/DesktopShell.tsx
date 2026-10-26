import { useEffect } from 'react'
import { installSystemCommands } from '../../system/commands'
import { parseDeepLink } from '../../system/shell'
import { useSystem } from '../../system/store'
import { LoginScreen } from './LoginScreen'
import { Wallpaper } from './Wallpaper'
import { WindowLayer } from './WindowLayer'

// Module scope: a shell remount must not reopen the deep-linked app.
let deepLinkHandled = false

export function DesktopShell() {
  const locked = useSystem((s) => s.locked)
  const setViewport = useSystem((s) => s.setViewport)
  const openApp = useSystem((s) => s.openApp)
  const unlock = useSystem((s) => s.unlock)

  useEffect(() => installSystemCommands(), [])

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
      <WindowLayer />
    </div>
  )
}
