import { DesktopShell } from './shells/desktop/DesktopShell'
import { MobilePlaceholder } from './shells/mobile/MobilePlaceholder'
import { useShell } from './system/shell'

export default function App() {
  const shell = useShell()
  return (
    <div data-testid="bymaxos-root" className="h-dvh w-dvw overflow-hidden">
      {shell === 'desktop' ? <DesktopShell /> : <MobilePlaceholder />}
    </div>
  )
}
