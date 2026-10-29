import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Plus, RotateCw, X } from 'lucide-react'
import { getContent } from '../../content'
import type { Bookmark } from '../../content/types'
import type { AppProps } from '../types'
import { parseAddress } from './address'

const CANNOT_SHOW = "This site can't be shown inside bymaxOS"
const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-forms'
const ICON_BUTTON =
  'grid h-7 w-7 shrink-0 place-items-center rounded-[4px] text-text-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent-link disabled:opacity-40 dark:hover:bg-white/10'
const PILL =
  'max-w-[180px] truncate rounded-[6px] px-2.5 py-1 text-[13px] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent-link dark:hover:bg-white/10'

// A tab's url is null on the Favorites start page.
interface Tab {
  id: number
  url: string | null
}

const hostOf = (url: string) => new URL(url).hostname

const titleOf = (url: string | null, bookmarks: Bookmark[]) =>
  url === null ? 'Favorites' : (bookmarks.find((b) => b.url === url)?.title ?? hostOf(url))

// Only a site on the origin of an embeddable bookmark is framed; bymaxOS's own origin never is.
const embeddable = (url: string, bookmarks: Bookmark[]) => {
  const origin = new URL(url).origin
  return origin !== window.location.origin && bookmarks.some((b) => b.embeddable && new URL(b.url).origin === origin)
}

export default function SafariApp({ props }: AppProps) {
  const bookmarks = getContent().bookmarks
  const start = typeof props?.url === 'string' ? parseAddress(props.url) : null
  const startUrl = start?.ok ? start.url : null
  const ids = useId()

  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: 1, url: startUrl }])
  const [activeId, setActiveId] = useState(1)
  const [address, setAddress] = useState(startUrl ?? '')
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0]
  const current = active.url
  const framed = current !== null && embeddable(current, bookmarks)
  const tabId = (id: number) => `${ids}-tab-${id}`

  const select = (tab: Tab) => {
    setActiveId(tab.id)
    setAddress(tab.url ?? '')
    setError(null)
  }

  const navigate = (url: string | null) => {
    setTabs(tabs.map((t) => (t.id === active.id ? { ...t, url } : t)))
    setAddress(url ?? '')
    setError(null)
  }

  const openTab = () => {
    const id = Math.max(...tabs.map((t) => t.id)) + 1
    setTabs([...tabs, { id, url: null }])
    select({ id, url: null })
  }

  // Removes a tab (never the last one) and returns the neighbour that takes its place.
  const removeTab = (tab: Tab): Tab => {
    const index = tabs.indexOf(tab)
    const rest = tabs.filter((t) => t.id !== tab.id)
    setTabs(rest)
    const neighbour = rest[Math.max(0, index - 1)]
    if (tab.id === active.id) select(neighbour)
    return neighbour
  }

  // Roving focus: arrows wrap, Home and End jump; the newly selected tab takes focus.
  // Delete or Backspace closes the focused tab and focuses its neighbour.
  const onTablistKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target
    if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'tab') return
    const focused = tabs.find((t) => tabId(t.id) === target.id)
    if (!focused) return

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (tabs.length === 1) return
      e.preventDefault()
      const neighbour = removeTab(focused)
      document.getElementById(tabId(neighbour.id))?.focus()
      return
    }

    const index = tabs.findIndex((t) => t.id === active.id)
    let next: number
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    select(tabs[next])
    document.getElementById(tabId(tabs[next].id))?.focus()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = parseAddress(address)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(result.url)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-black/10 px-3 pt-2 pb-1.5 dark:border-white/10">
        <div
          role="tablist"
          aria-label="Tabs"
          onKeyDown={onTablistKey}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 py-1"
        >
          {tabs.map((tab) => {
            const selected = tab.id === active.id
            const label = titleOf(tab.url, bookmarks)
            return (
              // The mouse-only close button is aria-hidden, so the tablist's accessible children are tabs only.
              <div
                key={tab.id}
                className={`flex shrink-0 items-center rounded-[6px] ${selected ? 'bg-white shadow-sm dark:bg-white/15' : ''}`}
              >
                <button
                  type="button"
                  role="tab"
                  id={tabId(tab.id)}
                  aria-selected={selected}
                  aria-controls={`${ids}-panel`}
                  aria-keyshortcuts="Delete"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(tab)}
                  className={`${PILL} ${selected ? 'text-text-1' : 'text-text-2'}`}
                >
                  {label}
                </button>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  aria-label={`Close ${label}`}
                  disabled={tabs.length === 1}
                  onClick={() => removeTab(tab)}
                  className={ICON_BUTTON}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )
          })}
        </div>
        <button type="button" aria-label="New tab" onClick={openTab} className={ICON_BUTTON}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <form onSubmit={submit} className="flex min-w-0 flex-1 flex-col">
          <input
            aria-label="Address"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${ids}-error` : undefined}
            value={address}
            onChange={(e) => {
              setAddress(e.target.value)
              setError(null)
            }}
            placeholder="Enter a web address"
            className="w-full rounded-[6px] bg-white px-3 py-1 text-[13px] text-text-1 shadow-inner outline-none placeholder:text-text-2 focus-visible:ring-2 focus-visible:ring-accent-link dark:bg-black/30"
          />
          {error && (
            <p id={`${ids}-error`} role="alert" className="mt-1 text-[12px] text-text-1">
              {error}
            </p>
          )}
        </form>
        {framed && (
          <button
            type="button"
            aria-label="Reload page"
            onClick={() => setReloadKey((k) => k + 1)}
            className={ICON_BUTTON}
          >
            <RotateCw className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <nav
        aria-label="Bookmarks"
        className="flex gap-1 overflow-x-auto border-b border-black/10 px-3 py-1 dark:border-white/10"
      >
        {bookmarks.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => navigate(b.url)}
            className="shrink-0 rounded-[6px] px-2 py-0.5 text-[12px] text-text-1 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent-link dark:hover:bg-white/10"
          >
            {b.title}
          </button>
        ))}
      </nav>

      <div
        role="tabpanel"
        id={`${ids}-panel`}
        aria-labelledby={tabId(active.id)}
        className="min-h-0 flex-1 overflow-auto"
      >
        {current === null ? (
          <section aria-label="Favorites" className="p-6">
            {bookmarks.length === 0 ? (
              <p className="text-[13px] text-text-2">No favorites yet.</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
                {bookmarks.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => navigate(b.url)}
                      className="flex w-full flex-col items-center gap-2 rounded-[10px] p-3 text-center hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent-link dark:hover:bg-white/10"
                    >
                      <span
                        aria-hidden
                        className="grid h-12 w-12 place-items-center rounded-[12px] bg-white text-[18px] font-semibold text-text-1 shadow-sm dark:bg-white/15"
                      >
                        {b.title.charAt(0)}
                      </span>
                      <span className="text-[13px] text-text-1">{b.title}</span>
                      <span className="max-w-full truncate text-[12px] text-text-2">{hostOf(b.url)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : framed ? (
          <iframe
            key={reloadKey}
            src={current}
            title={titleOf(current, bookmarks)}
            sandbox={SANDBOX}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex flex-col items-start gap-3 p-6">
            <h2 className="text-base font-semibold text-text-1">{CANNOT_SHOW}</h2>
            <p className="font-mono text-[12px] break-all text-text-2">{current}</p>
            <button
              type="button"
              onClick={() => window.open(current, '_blank', 'noopener,noreferrer')}
              className="rounded-md bg-accent-strong px-3 py-1.5 text-[13px] text-white outline-none focus-visible:ring-2 focus-visible:ring-accent-link"
            >
              Open in new tab ↗
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
