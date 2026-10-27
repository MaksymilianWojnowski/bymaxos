import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import { getContent } from '../../content'
import { formatDate } from '../../lib/format'
import { fetchLanguages, githubUser, loadRepos, type Repo, type RepoSource } from '../../lib/github'

const BUTTON =
  'rounded-[6px] border border-black/15 bg-white px-3 py-1 text-[13px] text-black dark:border-white/15 dark:bg-[#2a2a2a] dark:text-white'

// Language breakdowns are fetched once per repo and kept for the page's lifetime.
const languageCache = new Map<string, Record<string, number>>()

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

// Homepages are often typed without a scheme ("example.com"); those open over https.
const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

// Requests carry the component's signal so leaving the app cancels them.
const withSignal =
  (signal: AbortSignal): typeof fetch =>
  (input, init) =>
    fetch(input, { ...init, signal })

const percentages = (bytes: Record<string, number>): [string, number][] => {
  const total = Object.values(bytes).reduce((sum, n) => sum + n, 0)
  if (total === 0) return []
  return Object.entries(bytes)
    .sort(([, a], [, b]) => b - a)
    .map(([lang, n]) => [lang, Math.round((n / total) * 100)])
}

const stats = (repo: Repo): string =>
  [
    repo.stars !== undefined ? `★ ${repo.stars}` : null,
    repo.forks !== undefined ? (repo.forks === 1 ? '1 fork' : `${repo.forks} forks`) : null,
  ]
    .filter(Boolean)
    .join(' · ')

export default function DeveloperApp() {
  const { links, projects } = getContent()
  const user = githubUser(links.find((l) => l.id === 'github')?.url ?? '')
  const [loaded, setLoaded] = useState<{ repos: Repo[]; source: RepoSource } | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [langState, setLangState] = useState<{ repo: string; bytes: Record<string, number> | null } | null>(null)
  const uid = useId()

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    loadRepos(user, projects, withSignal(controller.signal)).then((result) => {
      if (!controller.signal.aborted) setLoaded(result)
    })
    return () => controller.abort()
  }, [user, projects])

  const repos = loaded?.repos ?? []
  const active = repos.find((r) => r.name === picked) ?? repos[0]
  const activeIndex = active ? repos.indexOf(active) : -1
  const activeName = active?.name
  // Fallback entries are content, not GitHub repos, so there is no breakdown to fetch for them.
  const fetchable = loaded?.source === 'api' || loaded?.source === 'cache'

  useEffect(() => {
    if (!user || !activeName || !fetchable || languageCache.has(activeName)) return
    const controller = new AbortController()
    fetchLanguages(user, activeName, withSignal(controller.signal))
      .then((bytes) => {
        languageCache.set(activeName, bytes)
        if (!controller.signal.aborted) setLangState({ repo: activeName, bytes })
      })
      .catch(() => {
        if (!controller.signal.aborted) setLangState({ repo: activeName, bytes: null })
      })
    return () => controller.abort()
  }, [user, activeName, fetchable])

  const bytes =
    activeName && fetchable
      ? (languageCache.get(activeName) ?? (langState?.repo === activeName ? langState.bytes : null))
      : null
  const optionId = (i: number) => `${uid}-${i}`

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (step === 0 || repos.length === 0) return
    e.preventDefault()
    const next = Math.min(repos.length - 1, Math.max(0, activeIndex + step))
    setPicked(repos[next].name)
  }

  if (!user) {
    return <p className="p-5 text-[13px] text-text-2">Not configured yet</p>
  }
  if (!loaded) {
    return (
      <p role="status" className="p-5 text-[13px] text-text-2">
        Loading repositories…
      </p>
    )
  }

  const homepage = active?.homepage?.trim() ?? ''
  const breakdown = bytes ? percentages(bytes) : []

  return (
    <div className="flex h-full min-h-0 flex-col bg-window font-sans text-[13px] text-text-1 md:flex-row">
      <aside className="flex min-h-0 flex-col border-b border-black/10 md:w-56 md:shrink-0 md:border-r md:border-b-0">
        {loaded.source === 'fallback' && (
          <p className="p-3 text-text-2">GitHub is unreachable — showing a saved list.</p>
        )}
        {repos.length === 0 ? (
          <p className="p-3 text-text-2">
            {loaded.source === 'fallback' ? 'No saved repositories.' : 'No public repositories yet.'}
          </p>
        ) : (
          <div
            role="listbox"
            tabIndex={0}
            aria-label="Repositories"
            aria-activedescendant={active ? optionId(activeIndex) : undefined}
            onKeyDown={onKeyDown}
            className="min-h-0 flex-1 overflow-auto p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {repos.map((repo, i) => {
              const selected = repo === active
              return (
                <div
                  key={repo.name}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onClick={() => setPicked(repo.name)}
                  className={`cursor-default rounded-md px-2 py-1 ${selected ? 'bg-accent-strong text-white' : 'hover:bg-black/5'}`}
                >
                  <span className="block truncate">
                    {repo.name}
                  </span>
                  {repo.language && (
                    <span className={`block truncate text-[12px] ${selected ? '' : 'opacity-70'}`}>{repo.language}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </aside>

      {active && (
        <section className="min-h-0 flex-1 overflow-auto p-5">
          <h2 className="text-[16px] font-semibold">{active.name}</h2>
          {active.description && <p className="mt-1 text-text-2">{active.description}</p>}
          {active.topics.length > 0 && (
            <ul aria-label="Topics" className="mt-3 flex flex-wrap gap-1.5">
              {active.topics.map((topic) => (
                <li key={topic} className="rounded-full bg-black/5 px-2 py-0.5 text-[12px] dark:bg-white/10">
                  {topic}
                </li>
              ))}
            </ul>
          )}
          {active.language && <p className="mt-3">Primary language: {active.language}</p>}
          {breakdown.length > 0 && (
            <ul aria-label="Languages" className="mt-1 text-text-2">
              {breakdown.map(([lang, pct]) => (
                <li key={lang}>{`${lang} ${pct}%`}</li>
              ))}
            </ul>
          )}
          {stats(active) && <p className="mt-3 text-text-2">{stats(active)}</p>}
          {active.updatedAt && <p className="mt-1 text-text-2">{`Updated ${formatDate(active.updatedAt)}`}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BUTTON} onClick={() => openExternal(active.url)}>
              View on GitHub ↗
            </button>
            {homepage && (
              <button type="button" className={BUTTON} onClick={() => openExternal(withScheme(homepage))}>
                Open demo ↗
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
