import { useEffect, useState } from 'react'
import { Battery, BatteryCharging, Search, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react'
import { canDispatch, dispatch } from '../../system/commands'
import { useSystem } from '../../system/store'
import { formatMenuClock } from './clock'
import { useBattery, useOnline } from './statusHooks'

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}

const ICON = 'h-4 w-4 text-text-1'

export function StatusArea() {
  const online = useOnline()
  const battery = useBattery()
  const now = useClock()
  const overlay = useSystem((s) => s.overlay)
  const setOverlay = useSystem((s) => s.setOverlay)
  const spotlightOk = canDispatch({ type: 'overlay.open', overlay: 'spotlight' })

  return (
    <div className="flex h-full items-center gap-3 text-[13px] text-text-1">
      <span role="img" aria-label={online ? 'Wi‑Fi: connected' : 'Wi‑Fi: offline'}>
        {online ? <Wifi aria-hidden="true" className={ICON} /> : <WifiOff aria-hidden="true" className={ICON} />}
      </span>
      {battery && (
        <span role="img" aria-label={`Battery ${Math.round(battery.level * 100)}%`} className="flex items-center gap-1">
          {battery.charging ? (
            <BatteryCharging aria-hidden="true" className={ICON} />
          ) : (
            <Battery aria-hidden="true" className={ICON} />
          )}
          <span aria-hidden="true">{Math.round(battery.level * 100)}%</span>
        </span>
      )}
      <button
        type="button"
        aria-label="Control Center"
        aria-pressed={overlay === 'controlCenter'}
        onClick={() => setOverlay(overlay === 'controlCenter' ? null : 'controlCenter')}
        className="flex h-[var(--mb-h)] items-center rounded-[4px] px-1"
      >
        <SlidersHorizontal aria-hidden="true" className={ICON} />
      </button>
      <button
        type="button"
        aria-label="Spotlight"
        aria-disabled={spotlightOk ? undefined : 'true'}
        onClick={() => {
          if (spotlightOk) dispatch({ type: 'overlay.open', overlay: 'spotlight' })
        }}
        className="flex h-[var(--mb-h)] items-center rounded-[4px] px-1 aria-disabled:opacity-40"
      >
        <Search aria-hidden="true" className={ICON} />
      </button>
      <time dateTime={now.toISOString()}>{formatMenuClock(now)}</time>
    </div>
  )
}
