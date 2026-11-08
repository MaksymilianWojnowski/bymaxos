import { useClock } from '../shells/desktop/statusHooks'
import { useShell } from '../system/shell'

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

// Live Calendar artwork: today's date, labelled the way each shell's Calendar icon is.
export function CalendarIcon({ size, dark }: { size: number; dark?: boolean }) {
  const now = useClock()
  const shell = useShell()
  const label = shell === 'mobile' ? WEEKDAY.format(now) : MONTH.format(now).toUpperCase()
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center"
      style={{ width: size, height: size, padding: size * 0.1 }}
    >
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{
          borderRadius: '22.5%',
          backgroundColor: dark ? '#1c1c1e' : '#ffffff',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(0, 0, 0, 0.25)',
        }}
      >
        <span style={{ color: '#ff3b30', fontSize: size * 0.13, fontWeight: 600, lineHeight: 1.1 }}>{label}</span>
        <span
          style={{
            color: dark ? '#ffffff' : '#1d1d1f',
            fontSize: size * 0.42,
            fontWeight: 300,
            lineHeight: 1.1,
          }}
        >
          {now.getDate()}
        </span>
      </div>
    </div>
  )
}
