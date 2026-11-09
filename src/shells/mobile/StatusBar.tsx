import { Wifi, WifiOff } from 'lucide-react'
import { useBattery, useClock, useNetwork, useOnline } from '../desktop/statusHooks'

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const ICON = 'h-4 w-4'

// Four bars of rising height, filled up to the reported quality; the rest are dimmed, not hidden.
function SignalBars({ bars }: { bars: 1 | 2 | 3 | 4 }) {
  return (
    <span role="img" aria-label={`Signal: ${bars} of 4 bars`}>
      <svg aria-hidden="true" width="17" height="11" viewBox="0 0 17 11" className="block">
        {[4, 6, 8, 10].map((h, i) => (
          <rect
            key={h}
            x={i * 4.5}
            y={11 - h}
            width="3"
            height={h}
            rx="0.5"
            fill="currentColor"
            opacity={i < bars ? 1 : 0.35}
          />
        ))}
      </svg>
    </span>
  )
}

// The fill is a fixed colour when charging or under 20%, so the state reads without the percentage.
function BatteryGlyph({ level, charging }: { level: number; charging: boolean }) {
  const fill = charging ? '#34c759' : level < 0.2 ? '#ff3b30' : 'currentColor'
  return (
    <svg aria-hidden="true" width="25" height="12" viewBox="0 0 25 12" className="block">
      <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" />
      <rect x="22.5" y="4" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="2" y="2" width={Math.max(0, 18 * level)} height="8" rx="1" fill={fill} />
    </svg>
  )
}

// Box-content keeps the 48px row whatever the notch inset is, so sheets can start below it.
// onWallpaper: white text with a shadow for the lock screen, whose wallpaper sits under the status bar.
export function StatusBar({ onWallpaper = false }: { onWallpaper?: boolean }) {
  const online = useOnline()
  const battery = useBattery()
  const network = useNetwork()
  const now = useClock()
  const percent = battery ? Math.round(battery.level * 100) : 0

  return (
    <div
      className={`box-content flex h-12 items-center justify-between pt-[env(safe-area-inset-top)] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] text-[15px] font-semibold ${onWallpaper ? 'text-white drop-shadow-md' : 'text-text-1'}`}
    >
      <time dateTime={now.toISOString()}>{clock.format(now)}</time>
      <div className="flex items-center gap-1.5">
        {online && network && <SignalBars bars={network.bars} />}
        <span role="img" aria-label={online ? 'Wi-Fi: connected' : 'Wi-Fi: offline'}>
          {online ? <Wifi aria-hidden="true" className={ICON} /> : <WifiOff aria-hidden="true" className={ICON} />}
        </span>
        {battery && (
          <span
            role="img"
            aria-label={`Battery ${percent}%${battery.charging ? ', charging' : ''}`}
            className="flex items-center gap-1"
          >
            <span aria-hidden="true" className="text-[12px] tabular-nums">
              {percent}%
            </span>
            <BatteryGlyph level={battery.level} charging={battery.charging} />
          </span>
        )}
      </div>
    </div>
  )
}
