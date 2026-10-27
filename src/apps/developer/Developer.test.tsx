import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeveloperApp from './Developer'

// Lets a test empty the content projects, which the fallback list is built from.
const content = vi.hoisted(() => ({ projects: null as unknown[] | null }))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (...args: Parameters<typeof actual.getContent>) => {
      const c = actual.getContent(...args)
      return content.projects ? { ...c, projects: content.projects } : c
    },
  }
})

const json = (data: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => data }) as unknown as Response

const REPOS = [
  {
    name: 'bymaxos',
    description: 'Desk simulator',
    html_url: 'https://github.com/MaksymilianWojnowski/bymaxos',
    homepage: 'https://bymaxos.example',
    language: 'TypeScript',
    topics: ['react', 'vite'],
    updated_at: '2026-10-12T12:00:00Z',
    stargazers_count: 3,
    forks_count: 1,
    fork: false,
  },
  {
    name: 'dotfiles',
    description: null,
    html_url: 'https://github.com/MaksymilianWojnowski/dotfiles',
    homepage: '',
    language: 'Shell',
    topics: [],
    updated_at: '2026-09-01T12:00:00Z',
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
  },
  {
    name: 'broken-langs',
    description: 'Go service',
    html_url: 'https://github.com/MaksymilianWojnowski/broken-langs',
    homepage: null,
    language: 'Go',
    topics: [],
    updated_at: '2026-08-01T12:00:00Z',
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
  },
]

const LANGUAGES: Record<string, Record<string, number> | 'fail'> = {
  bymaxos: { TypeScript: 75, CSS: 25 },
  dotfiles: { Shell: 100 },
  'broken-langs': 'fail',
}

let apiRepos: unknown[]
let apiStatus: number
const fetchMock = vi.fn(async (input: string) => {
  if (input.includes('/languages')) {
    const repo = /\/repos\/[^/]+\/([^/]+)\/languages/.exec(input)?.[1] ?? ''
    const langs = LANGUAGES[repo]
    return langs === undefined || langs === 'fail' ? json({}, 500) : json(langs)
  }
  return apiStatus === 200 ? json(apiRepos) : json({}, apiStatus)
})

beforeEach(() => {
  window.sessionStorage.clear()
  apiRepos = REPOS
  apiStatus = 200
  content.projects = null
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Developer', () => {
  it('shows a loading status, then the repository list', async () => {
    render(<DeveloperApp />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading repositories…')

    const list = await screen.findByRole('listbox', { name: 'Repositories' })
    expect(within(list).getByRole('option', { name: /^bymaxos/ })).toBeInTheDocument()
    expect(within(list).getByRole('option', { name: /^dotfiles/ })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('selecting a repo shows its description, topics, language percentages and links', async () => {
    const user = userEvent.setup()
    render(<DeveloperApp />)
    const list = await screen.findByRole('listbox', { name: 'Repositories' })

    await user.click(within(list).getByRole('option', { name: /^bymaxos/ }))

    expect(await screen.findByText('TypeScript 75%')).toBeInTheDocument()
    expect(screen.getByText('CSS 25%')).toBeInTheDocument()
    expect(screen.getByText('Desk simulator')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('★ 3 · 1 fork')).toBeInTheDocument()
    expect(screen.getByText('Updated Oct 12, 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View on GitHub ↗' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open demo ↗' })).toBeInTheDocument()
  })

  it('omits the demo button when the repo has no homepage', async () => {
    const user = userEvent.setup()
    render(<DeveloperApp />)
    const list = await screen.findByRole('listbox', { name: 'Repositories' })

    await user.click(within(list).getByRole('option', { name: /^dotfiles/ }))

    expect(await screen.findByText('Shell 100%')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open demo ↗' })).not.toBeInTheDocument()
  })

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<DeveloperApp />)
    const list = await screen.findByRole('listbox', { name: 'Repositories' })

    list.focus()
    await user.keyboard('{ArrowDown}')

    expect(within(list).getByRole('option', { name: /^dotfiles/ })).toHaveAttribute('aria-selected', 'true')
    expect(list).toHaveAttribute('aria-activedescendant', expect.stringContaining('-1'))
  })

  it('fallback shows the note and no GitHub numbers or fetched breakdown', async () => {
    apiStatus = 503
    render(<DeveloperApp />)

    expect(await screen.findByText('GitHub is unreachable — showing a saved list.')).toBeInTheDocument()
    const list = screen.getByRole('listbox', { name: 'Repositories' })
    expect(within(list).getByRole('option', { name: 'LigaPWr Web App' })).toBeInTheDocument()
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument()
    expect(screen.queryByText(/★/)).not.toBeInTheDocument()
    expect(screen.queryByText(/fork/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/languages'))).toBe(false)
  })

  it('a failed language request hides the breakdown but keeps the primary language', async () => {
    const user = userEvent.setup()
    render(<DeveloperApp />)
    const list = await screen.findByRole('listbox', { name: 'Repositories' })

    await user.click(within(list).getByRole('option', { name: /^broken-langs/ }))

    expect(await screen.findByText('Primary language: Go')).toBeInTheDocument()
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View on GitHub ↗' })).toBeInTheDocument()
  })

  it('shows the empty message when the account has no public repositories', async () => {
    apiRepos = []
    render(<DeveloperApp />)

    expect(await screen.findByText('No public repositories yet.')).toBeInTheDocument()
  })

  it('says no repositories are saved when the fallback list is empty', async () => {
    apiStatus = 503
    content.projects = []
    render(<DeveloperApp />)

    expect(await screen.findByText('No saved repositories.')).toBeInTheDocument()
    expect(screen.queryByText('No public repositories yet.')).not.toBeInTheDocument()
  })

  it('opens a scheme-less homepage over https', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    apiRepos = [{ ...REPOS[0], homepage: 'bymaxos.example' }]
    render(<DeveloperApp />)

    await user.click(await screen.findByRole('button', { name: 'Open demo ↗' }))

    expect(open).toHaveBeenCalledWith('https://bymaxos.example', '_blank', 'noopener,noreferrer')
  })

  it('hides the demo button for a whitespace-only homepage', async () => {
    apiRepos = [{ ...REPOS[0], homepage: '   ' }]
    render(<DeveloperApp />)

    expect(await screen.findByRole('button', { name: 'View on GitHub ↗' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open demo ↗' })).not.toBeInTheDocument()
  })

  it('keeps the language label dimmed on unselected rows only', async () => {
    render(<DeveloperApp />)
    const list = await screen.findByRole('listbox', { name: 'Repositories' })

    expect(within(list).getByText('TypeScript')).not.toHaveClass('opacity-70')
    expect(within(list).getByText('Shell')).toHaveClass('opacity-70')
  })
})
