import { useSystem } from '../../system/store'
import { AppSwitcher } from './AppSwitcher'
import { Launchpad } from './Launchpad'
import { Spotlight } from './Spotlight'

// Mount point for system overlays: only the open one renders, since overlay holds a single value.
export function Overlays() {
  const overlay = useSystem((s) => s.overlay)
  if (overlay === 'spotlight') return <Spotlight />
  if (overlay === 'launchpad') return <Launchpad />
  if (overlay === 'appSwitcher') return <AppSwitcher />
  return null
}
