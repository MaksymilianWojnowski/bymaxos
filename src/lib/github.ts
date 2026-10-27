import type { Project } from '../content/types'
import { KEYS, safeStorage } from '../system/storage'

export interface Repo {
  name: string
  description: string | null
  url: string
  homepage: string | null
  language: string | null
  topics: string[]
  updatedAt?: string
  stars?: number
  forks?: number
}

interface ApiRepo {
  name: string
  description: string | null
  html_url: string
  homepage: string | null
  language: string | null
  topics?: string[]
  updated_at: string
  stargazers_count: number
  forks_count: number
  fork: boolean
}

interface Cached {
  user: string
  repos: Repo[]
}

export type RepoSource = 'api' | 'cache' | 'fallback'

const HEADERS = { Accept: 'application/vnd.github+json' }

export function githubUser(profileUrl: string): string | null {
  const match = /^https:\/\/github\.com\/([^/?#]+)\/?$/.exec(profileUrl)
  return match ? match[1] : null
}

async function getJson<T>(url: string, fetchFn: typeof fetch): Promise<T> {
  const res = await fetchFn(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`)
  return (await res.json()) as T
}

export async function fetchRepos(user: string, fetchFn: typeof fetch = fetch): Promise<Repo[]> {
  const data = await getJson<ApiRepo[]>(
    `https://api.github.com/users/${user}/repos?sort=updated&per_page=100`,
    fetchFn,
  )
  return data
    .filter((r) => !r.fork)
    .map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      homepage: r.homepage || null,
      language: r.language,
      topics: r.topics ?? [],
      updatedAt: r.updated_at,
      stars: r.stargazers_count,
      forks: r.forks_count,
    }))
}

export function fetchLanguages(
  user: string,
  repo: string,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, number>> {
  return getJson<Record<string, number>>(`https://api.github.com/repos/${user}/${repo}/languages`, fetchFn)
}

// Content projects that name a repo; GitHub numbers are unknown here, so none are set.
export function fallbackRepos(projects: Project[]): Repo[] {
  return projects.flatMap((p) =>
    p.links.repo
      ? [
          {
            name: p.title,
            description: p.summary,
            url: p.links.repo,
            homepage: p.links.demo ?? null,
            language: null,
            topics: p.tech,
          },
        ]
      : [],
  )
}

// The API result is kept for the session; a failed request is not, so the next open tries again.
export async function loadRepos(
  user: string,
  projects: Project[],
  fetchFn: typeof fetch = fetch,
): Promise<{ repos: Repo[]; source: RepoSource }> {
  const cached = safeStorage.get<Cached | null>('session', KEYS.github, null)
  if (cached && cached.user === user && Array.isArray(cached.repos)) return { repos: cached.repos, source: 'cache' }
  try {
    const repos = await fetchRepos(user, fetchFn)
    safeStorage.set('session', KEYS.github, { user, repos })
    return { repos, source: 'api' }
  } catch {
    return { repos: fallbackRepos(projects), source: 'fallback' }
  }
}
