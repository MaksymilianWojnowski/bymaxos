import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Search } from 'lucide-react'
import { APPS, getApp } from '../../apps/registry'
import { nodeById } from '../../apps/finder/vfsInstance'
import { mergeNotes, parseStoredNotes } from '../../apps/notes/notesState'
import { getContent } from '../../content'
import { buildIndex, rank, type SearchItem } from '../../system/search'
import { KEYS, safeStorage } from '../../system/storage'
import { useSystem } from '../../system/store'
import type { AppId } from '../../system/types'
import { AppIcon } from '../../ui/AppIcon'
import { iconFor } from '../../ui/fileIcon'
import { StatusBar } from './StatusBar'

function ResultIcon({ item }: { item: SearchItem }) {
  if (item.appId) {
    const app = getApp(item.appId)
    return app ? <AppIcon app={app} size={36} /> : null
  }
  const node = item.nodeId ? nodeById(item.nodeId) : undefined
  return node ? <img src={iconFor(node)} alt="" aria-hidden="true" draggable={false} className="h-9 w-9" /> : null
}

// Below the status bar, which insets itself, the content clears the notch sideways in landscape.
const INSET = 'pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]'

// Full-screen search over the same index as Spotlight. Its home screen is inert while it is open.
export function MobileSearch({ onClose }: { onClose: () => void }) {
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  // Built on mount, not at import: the index reads the app registry, which other shells' tests stub.
  // A result whose app is hidden on mobile would open nothing, so it is left out.
  const index = useMemo(
    () =>
      buildIndex(
        getContent(),
        APPS,
        mergeNotes(getContent().notes, parseStoredNotes(safeStorage.get<unknown>('local', KEYS.notes, null))),
      ).filter(
        (item) => getApp(item.command.appId as AppId)?.mobile?.presentation !== 'hidden',
      ),
    [],
  )
  const results = useMemo(() => rank(index, query), [index, query])
  const activeItem = results[active]

  // Keeps the option chosen from the keyboard on screen; jsdom has no scrollIntoView.
  useEffect(() => {
    document.getElementById(`${listId}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, listId])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      // Focus goes back to the opener only when nothing else took it; an opener that unmounted is skipped.
      const current = document.activeElement
      if (opener?.isConnected && (current === null || current === document.body)) opener.focus()
    }
  }, [])

  // Only the commands that open an app have a mobile meaning; the rest are ignored.
  const run = (item: SearchItem) => {
    const cmd = item.command
    if (cmd.type !== 'dock.activate' && cmd.type !== 'app.open') return
    onClose()
    openMobileApp(cmd.appId as AppId, cmd.props as Record<string, unknown> | undefined)
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
    } else if (e.key === 'Enter' && activeItem && !e.nativeEvent.isComposing) {
      e.preventDefault()
      run(activeItem)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      className="absolute inset-0 flex flex-col bg-window font-sans text-text-1"
    >
      <StatusBar />

      <div className={`flex min-h-0 flex-1 flex-col ${INSET}`}>
        <div className="flex items-center gap-2 px-4 pb-3">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border px-3 focus-within:ring-2 focus-within:ring-accent-link"
            style={{ background: 'var(--window-bg)', borderColor: 'var(--glass-border)' }}
          >
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-text-2" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Search"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls={results.length > 0 ? listId : undefined}
              aria-activedescendant={activeItem ? `${listId}-option-${active}` : undefined}
              value={query}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search"
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-text-2"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center px-2 text-[17px] text-accent-link focus-visible:ring-2 focus-visible:ring-accent-link"
          >
            Cancel
          </button>
        </div>

        {query.trim() !== '' && results.length === 0 && (
          <p role="status" className="px-4 py-3 text-[15px] text-text-2">
            No Results
          </p>
        )}

        {results.length > 0 && (
          <ul
            role="listbox"
            id={listId}
            aria-label="Results"
            className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]"
          >
            {results.map((item, i) => {
              const isActive = i === active
              return (
                <li
                  key={item.id}
                  id={`${listId}-option-${i}`}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => run(item)}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 px-4 ${isActive ? 'bg-accent-strong text-white' : ''}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                    <ResultIcon item={item} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[16px]">{item.title}</span>
                    {item.subtitle && (
                      <span className={`truncate text-[13px] ${isActive ? 'text-white' : 'text-text-2'}`}>
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
