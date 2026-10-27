import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '../content/types'
import { KEYS } from '../system/storage'
import { fallbackRepos, fetchLanguages, fetchRepos, githubUser, loadRepos } from './github'

const USER = 'MaksymilianWojnowski'

const apiRepo = (over: Record<string, unknown> = {}) => ({
  name: 'bymaxos',
  description: 'Desk simulator',
  html_url: 'https://github.com/MaksymilianWojnowski/bymaxos',
  homepage: '',
  language: 'TypeScript',
  topics: ['react'],
  updated_at: '2026-10-12T12:00:00Z',
  stargazers_count: 3,
  forks_count: 1,
  fork: false,
  ...over,
})

const response = (data: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => data }) as unknown as Response

const projects: Project[] = [
  {
    id: 'with-repo',
    title: 'LigaPWr Web App',
    summary: 'Team of 5',
    bullets: [],
    tech: ['Django'],
    links: { repo: 'https://github.com/informatyzacja/LigaPWr', demo: 'https://ligapwr.example' },
  },
  { id: 'no-repo', title: 'Hackathon', summary: 'Event', bullets: [], tech: [], links: {} },
]

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('githubUser', () => {
  it('parses the profile URL', () => {
    expect(githubUser('https://github.com/MaksymilianWojnowski')).toBe(USER)
    expect(githubUser('https://github.com/MaksymilianWojnowski/')).toBe(USER)
    expect(githubUser('https://example.com/x')).toBeNull()
  })
})

describe('fetchRepos', () => {
  it('requests the user repos sorted by update and maps them, dropping forks', async () => {
    const fetchFn = vi.fn(async () => response([apiRepo(), apiRepo({ name: 'forked', fork: true })]))

    const repos = await fetchRepos(USER, fetchFn as unknown as typeof fetch)

    expect(fetchFn).toHaveBeenCalledWith(`https://api.github.com/users/${USER}/repos?sort=updated&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    expect(repos).toEqual([
      {
        name: 'bymaxos',
        description: 'Desk simulator',
        url: 'https://github.com/MaksymilianWojnowski/bymaxos',
        homepage: null,
        language: 'TypeScript',
        topics: ['react'],
        updatedAt: '2026-10-12T12:00:00Z',
        stars: 3,
        forks: 1,
      },
    ])
  })

  it('throws on a non-ok response', async () => {
    const fetchFn = vi.fn(async () => response({}, 403))
    await expect(fetchRepos(USER, fetchFn as unknown as typeof fetch)).rejects.toThrow()
  })
})

describe('fetchLanguages', () => {
  it('requests the repo languages', async () => {
    const fetchFn = vi.fn<(url: string) => Promise<Response>>(async () => response({ TypeScript: 75, CSS: 25 }))

    const languages = await fetchLanguages(USER, 'bymaxos', fetchFn as unknown as typeof fetch)

    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.github.com/repos/${USER}/bymaxos/languages`,
      expect.anything(),
    )
    expect(languages).toEqual({ TypeScript: 75, CSS: 25 })
  })
})

describe('fallbackRepos', () => {
  it('lists the content projects that link a repo, without GitHub numbers', () => {
    expect(fallbackRepos(projects)).toEqual([
      {
        name: 'LigaPWr Web App',
        description: 'Team of 5',
        url: 'https://github.com/informatyzacja/LigaPWr',
        homepage: 'https://ligapwr.example',
        language: null,
        topics: ['Django'],
      },
    ])
  })
})

describe('loadRepos', () => {
  it('caches the API result for the session', async () => {
    const fetchFn = vi.fn(async () => response([apiRepo()]))
    const cast = fetchFn as unknown as typeof fetch

    const first = await loadRepos(USER, projects, cast)
    const second = await loadRepos(USER, projects, cast)

    expect(first.source).toBe('api')
    expect(second.source).toBe('cache')
    expect(second.repos).toEqual(first.repos)
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(KEYS.github)).not.toBeNull()
  })

  it('falls back to content projects when the API fails', async () => {
    const fetchFn = vi.fn(async () => response({}, 500))

    const result = await loadRepos(USER, projects, fetchFn as unknown as typeof fetch)

    expect(result.source).toBe('fallback')
    expect(result.repos).toEqual(fallbackRepos(projects))
    expect(result.repos[0].stars).toBeUndefined()
    expect(result.repos[0].forks).toBeUndefined()
    expect(result.repos[0].updatedAt).toBeUndefined()
  })

  it('does not cache a failed request, so the next call asks again', async () => {
    const fetchFn = vi.fn(async () => response({}, 500))
    const cast = fetchFn as unknown as typeof fetch

    await loadRepos(USER, projects, cast)
    const again = await loadRepos(USER, projects, cast)

    expect(again.source).toBe('fallback')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })
})
