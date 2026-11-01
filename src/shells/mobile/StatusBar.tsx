import { Battery, BatteryCharging, Wifi, WifiOff } from 'lucide-react'
import { useBattery, useClock, useOnline } from '../desktop/statusHooks'

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const ICON = 'h-4 w-4'

// Box-content keeps the 48px row whatever the notch inset is, so sheets can start below it.
// onWallpaper: white text with a shadow for the lock screen, whose wallpaper sits under the status bar.
export function StatusBar({ onWallpaper = false }: { onWallpaper?: boolean }) {
  const online = useOnline()
  const battery = useBattery()
  const now = useClock()
  const percent = battery ? Math.round(battery.level * 100) : 0

  return (
    <div
      className={`box-content flex h-12 items-center justify-between pt-[env(safe-area-inset-top)] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] text-[15px] font-semibold ${onWallpaper ? 'text-white drop-shadow-md' : 'text-text-1'}`}
    >
      <time dateTime={now.toISOString()}>{clock.format(now)}</time>
      <div className="flex items-center gap-1.5">
        <span role="img" aria-label={online ? 'Wi-Fi: connected' : 'Wi-Fi: offline'}>
          {online ? <Wifi aria-hidden="true" className={ICON} /> : <WifiOff aria-hidden="true" className={ICON} />}
        </span>
        {battery && (
          <span role="img" aria-label={`Battery ${percent}%`} className="flex items-center gap-1">
            {battery.charging ? (
              <BatteryCharging aria-hidden="true" className={ICON} />
            ) : (
              <Battery aria-hidden="true" className={ICON} />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
