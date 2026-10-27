import { useSystem } from '../../system/store'
import { Spotlight } from './Spotlight'

// Mount point for system overlays: only the open one renders, since overlay holds a single value.
export function Overlays() {
  const overlay = useSystem((s) => s.overlay)
  return overlay === 'spotlight' ? <Spotlight /> : null
}
