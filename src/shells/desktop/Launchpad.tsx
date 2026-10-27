import { useEffect, useRef, useState } from 'react'
import { launchpadApps } from '../../apps/registry'
import { dispatch } from '../../system/commands'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'

// The app list is static, so it is read once per page load.
const APPS = launchpadApps()

const LABEL_SHADOW = { textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)' }

// Full-screen grid of apps; it covers the menu bar and the dock, so Escape or a click on the background closes it.
export function Launchpad() {
  const setOverlay = useSystem((s) => s.setOverlay)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLocaleLowerCase('en')
  const apps = needle === '' ? APPS : APPS.filter((a) => a.name.toLocaleLowerCase('en').includes(needle))

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close first: the app may open an overlay of its own, which must survive.
  const run = (appId: string) => {
    setOverlay(null)
    dispatch({ type: 'dock.activate', appId })
  }

  return (
    <div
      data-testid="launchpad-backdrop"
      className="launchpad-backdrop fixed inset-0 z-50 flex justify-center overflow-auto font-sans text-white"
      onMouseDown={(e) => {
        if (!(e.target as Element).closest('button, input')) setOverlay(null)
      }}
    >
      <div role="dialog" aria-label="Launchpad" className="flex w-full max-w-[960px] flex-col items-center px-4 pt-14 pb-10">
        <input
          ref={inputRef}
          type="search"
          aria-label="Search apps"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mb-10 w-[220px] rounded-[8px] bg-white/20 px-3 py-1.5 text-center text-[13px] text-white outline-none placeholder:text-white/80 focus-visible:ring-2 focus-visible:ring-accent"
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
                className="flex w-[120px] flex-col items-center gap-2 rounded-[12px] p-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
