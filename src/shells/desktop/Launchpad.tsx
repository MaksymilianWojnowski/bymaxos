import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { launchpadApps } from '../../apps/registry'
import { dispatch } from '../../system/commands'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'

// The app list is static, so it is read once per page load.
const APPS = launchpadApps()

const LABEL_SHADOW = { textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }
const FADE_MS = 150

// Full-screen grid of apps; it covers the menu bar and the dock, so Escape or a click on the background closes it.
export function Launchpad() {
  const setOverlay = useSystem((s) => s.setOverlay)
  const reduceMotion = useSystem((s) => s.settings.reduceMotion)
  const [query, setQuery] = useState('')
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLocaleLowerCase('en')
  const apps = needle === '' ? APPS : APPS.filter((a) => a.name.toLocaleLowerCase('en').includes(needle))

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      window.clearTimeout(timer.current)
      // Focus goes back to the opener only when the panel lost it; a window that took focus keeps it.
      const active = document.activeElement
      if (opener?.isConnected && (active === null || active === document.body)) opener.focus()
    }
  }, [])

  // Tab cycles through the search field and the app buttons only, so focus cannot leave the full-screen panel.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('input, button'))
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // Fades out, then closes; under reduce-motion it closes at once. Esc and the dock toggle close instantly, via the store.
  const close = () => {
    if (timer.current !== undefined) return
    if (reduceMotion) {
      setOverlay(null)
      return
    }
    setClosing(true)
    timer.current = window.setTimeout(() => setOverlay(null), FADE_MS)
  }

  // Launchpad apps never open an overlay themselves, so the dispatch can run before the close.
  const run = (appId: string) => {
    dispatch({ type: 'dock.activate', appId })
    close()
  }

  return (
    <div
      data-testid="launchpad-backdrop"
      className={`launchpad-backdrop${closing ? ' launchpad-backdrop-closing' : ''} fixed inset-0 z-50 flex justify-center overflow-auto font-sans text-white`}
      onMouseDown={(e) => {
        if (!(e.target as Element).closest('button, input')) close()
      }}
    >
      <div
        role="dialog"
        aria-label="Launchpad"
        onKeyDown={onKeyDown}
        className="flex w-full max-w-[960px] flex-col items-center px-4 pt-14 pb-10"
      >
        <input
          ref={inputRef}
          type="search"
          aria-label="Search apps"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mb-10 w-[220px] rounded-[8px] bg-black/40 px-3 py-1.5 text-center text-[13px] text-white outline-none placeholder:text-white/80 focus-visible:ring-2 focus-visible:ring-white"
          style={LABEL_SHADOW}
        />

        <ul
          aria-label="Apps"
          className="grid w-full grid-cols-[repeat(auto-fill,minmax(120px,1fr))] justify-items-center gap-y-6"
        >
          {apps.map((app) => (
            <li key={app.id}>
              <button
                type="button"
                onClick={() => run(app.id)}
                className="flex w-[120px] flex-col items-center gap-2 rounded-[12px] p-2 outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <AppIcon app={app} size={80} />
                <span className="text-[13px] text-white" style={LABEL_SHADOW}>
                  {app.name}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {needle !== '' && apps.length === 0 && (
          <p role="status" className="mt-6 text-[13px] text-white" style={LABEL_SHADOW}>
            No Results
          </p>
        )}
      </div>
    </div>
  )
}
