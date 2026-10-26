import { useEffect, useRef } from 'react'
import { installSystemCommands } from '../../system/commands'
import { parseDeepLink } from '../../system/shell'
import { useSystem } from '../../system/store'
import { LoginScreen } from './LoginScreen'
import { Wallpaper } from './Wallpaper'

export function DesktopShell() {
  const locked = useSystem((s) => s.locked)
  const setViewport = useSystem((s) => s.setViewport)
  const openApp = useSystem((s) => s.openApp)
  const unlock = useSystem((s) => s.unlock)
  const deepLinked = useRef(false)

  useEffect(() => installSystemCommands(), [])

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth, window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setViewport])

  useEffect(() => {
    if (locked || deepLinked.current) return
    deepLinked.current = true
    const link = parseDeepLink(window.location.search)
    if (link) openApp(link.appId, link.item ? { item: link.item } : undefined)
  }, [locked, openApp])

  if (locked) return <LoginScreen onUnlock={unlock} />

  return (
    <div data-testid="desktop" className="relative h-full w-full">
      <Wallpaper />
    </div>
  )
}
