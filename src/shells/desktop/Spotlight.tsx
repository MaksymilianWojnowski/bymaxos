import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { APPS, getApp } from '../../apps/registry'
import { nodeById } from '../../apps/finder/vfsInstance'
import { getContent } from '../../content'
import { dispatch } from '../../system/commands'
import { buildIndex, rank, type SearchItem } from '../../system/search'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'
import { iconFor } from '../../ui/fileIcon'

// Content and the app registry are static, so the index is built once per page load.
const INDEX = buildIndex(getContent(), APPS)

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  borderColor: 'var(--glass-border)',
}

function ResultIcon({ item }: { item: SearchItem }) {
  if (item.appId) {
    const app = getApp(item.appId)
    return app ? <AppIcon app={app} size={28} /> : null
  }
  const node = item.nodeId ? nodeById(item.nodeId) : undefined
  return node ? <img src={iconFor(node)} alt="" aria-hidden="true" draggable={false} className="h-7 w-7" /> : null
}

export function Spotlight() {
  const setOverlay = useSystem((s) => s.setOverlay)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const results = useMemo(() => rank(INDEX, query), [query])
  const activeItem = results[active]

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      // Focus goes back to the opener only when the panel lost it; a window that took focus keeps it.
      const active = document.activeElement
      if (opener?.isConnected && (active === null || active === document.body)) opener.focus()
    }
  }, [])

  // Close first: a result can open an overlay itself (Launchpad), which must survive.
  const run = (item: SearchItem) => {
    setOverlay(null)
    dispatch(item.command)
  }

  const onChange = (value: string) => {
    setQuery(value)
    setActive(0)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + step + results.length) % results.length)
    } else if (e.key === 'Enter' && activeItem) {
      e.preventDefault()
      run(activeItem)
    }
  }

  const optionId = (i: number) => `${listId}-option-${i}`

  return (
    // The backdrop only catches presses outside the panel; Escape is handled by the global overlay.close.
    <div
      data-testid="spotlight-backdrop"
      className="fixed inset-0 z-50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOverlay(null)
      }}
    >
      <div
        role="dialog"
        aria-label="Spotlight"
        className="absolute top-[20vh] left-1/2 flex w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[14px] border font-sans text-text-1 shadow-lg"
        style={GLASS}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-text-2" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label="Spotlight Search"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={results.length > 0 ? listId : undefined}
            aria-activedescendant={activeItem ? optionId(active) : undefined}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Spotlight Search"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[20px] outline-none placeholder:text-text-2"
          />
        </div>

        {query.trim() !== '' && results.length === 0 && (
          <p role="status" className="border-t px-4 py-3 text-[13px] text-text-2" style={{ borderColor: 'var(--glass-border)' }}>
            No Results
          </p>
        )}

        {results.length > 0 && (
          <ul
            role="listbox"
            id={listId}
            aria-label="Results"
            className="max-h-[420px] overflow-auto border-t p-1.5"
            style={{ borderColor: 'var(--glass-border)' }}
          >
            {results.map((item, i) => {
              const isActive = i === active
              return (
                <li
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(item)}
                  className={`flex cursor-default items-center gap-3 rounded-[8px] px-2.5 py-1.5 ${
                    isActive ? 'bg-accent-strong text-white' : 'text-text-1'
                  }`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <ResultIcon item={item} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[14px]">{item.title}</span>
                    {item.subtitle && (
                      <span className={`truncate text-[12px] ${isActive ? 'text-white' : 'text-text-2'}`}>
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
