import { useEffect, useRef, useState, type KeyboardEvent, type WheelEvent } from 'react'
import { getContent } from '../../content'
import { Wallpaper } from './Wallpaper'

const UNLOCK_MS = 300
const CLOCK_MS = 15_000

const clockText = (d: Date): string =>
  `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`

const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

// First letter of the first and last word, e.g. "Maksymilian Wojnowski" -> "MW".
function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function LoginScreen({ onUnlock }: { onUnlock: () => void }) {
  const { profile } = getContent()
  const [now, setNow] = useState(() => new Date())
  const [unlocking, setUnlocking] = useState(false)
  const started = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CLOCK_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const unlock = () => {
    if (started.current) return
    started.current = true
    if (document.documentElement.classList.contains('reduce-motion')) {
      onUnlock()
      return
    }
    setUnlocking(true)
    timer.current = window.setTimeout(onUnlock, UNLOCK_MS)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      unlock()
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (e.deltaY < 0) unlock()
  }

  return (
    <div
      ref={root}
      role="button"
      aria-label="Unlock"
      tabIndex={0}
      onClick={unlock}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      className={`relative flex h-full w-full cursor-default flex-col items-center justify-center overflow-hidden text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 focus-visible:outline-none${unlocking ? ' login-unlocking' : ''}`}
    >
      <Wallpaper />
      <div aria-hidden="true" className="login-blur absolute inset-0" />
      <div className="relative flex flex-col items-center text-center drop-shadow-md">
        <p className="text-7xl font-light tracking-tight tabular-nums">{clockText(now)}</p>
        <p className="mt-1 text-lg font-medium">{dateFormat.format(now)}</p>

        <div
          aria-hidden="true"
          className="mt-12 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white/25 text-2xl font-semibold"
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(profile.name)
          )}
        </div>
        <p className="mt-3 text-base font-semibold">{profile.name}</p>
        <p className="mt-6 text-sm opacity-80">Click or press Enter to unlock</p>
      </div>
    </div>
  )
}
