import { useLayoutEffect } from 'react'
import { DesktopShell } from './shells/desktop/DesktopShell'
import { MobileShell } from './shells/mobile/MobileShell'
import { useShell } from './system/shell'

export default function App() {
  const shell = useShell()
  useLayoutEffect(() => {
    document.documentElement.dataset.shell = shell
  }, [shell])
  return (
    <div data-testid="bymaxos-root" className="h-dvh w-dvw overflow-hidden">
      {shell === 'desktop' ? <DesktopShell /> : <MobileShell />}
    </div>
  )
}
