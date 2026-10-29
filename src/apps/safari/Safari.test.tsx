import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import type { Bookmark } from '../../content/types'
import SafariApp from './Safari'

// Extra bookmarks a test adds on top of the real content (e.g. an embeddable one).
const extra = vi.hoisted(() => ({ bookmarks: [] as Bookmark[] }))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (locale?: 'en') => {
      const content = actual.getContent(locale)
      return { ...content, bookmarks: [...content.bookmarks, ...extra.bookmarks] }
    },
  }
})

const bookmarks = getContent().bookmarks
const plain = bookmarks.find((b) => !b.embeddable) as Bookmark
const demo: Bookmark = { id: 'demo', title: 'Demo Page', url: 'https://demo.example/', embeddable: true }

const favorites = () => screen.getByRole('region', { name: 'Favorites' })
const bookmarksBar = () => screen.getByRole('navigation', { name: 'Bookmarks' })
const address = () => screen.getByRole('textbox', { name: 'Address' })
const cannotShow = () => screen.queryByText("This site can't be shown inside bymaxOS")
const frame = () => document.querySelector('iframe')
// Close buttons are aria-hidden, so their accessible name is empty and role queries cannot find them.
const closeButton = (label: string) =>
  document.querySelector<HTMLButtonElement>(`button[aria-label="Close ${label}"]`) as HTMLButtonElement
const reload = () => screen.queryByRole('button', { name: 'Reload page' })

async function go(url: string) {
  await userEvent.clear(address())
  await userEvent.type(address(), `${url}{Enter}`)
}

let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  extra.bookmarks = []
  open = vi.spyOn(window, 'open').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Safari', () => {
  it('opens on a Favorites start page listing every bookmark as a tile', () => {
    render(<SafariApp windowId="w1" />)

    expect(screen.getByRole('tab', { name: 'Favorites', selected: true })).toBeInTheDocument()
    expect(within(favorites()).getAllByRole('button')).toHaveLength(bookmarks.length)
    expect(within(favorites()).getByRole('button', { name: new RegExp(`^${plain.title}`) })).toBeInTheDocument()
  })

  it('a non-embeddable bookmark shows the honest card with Open in new tab, and never renders an iframe', async () => {
    render(<SafariApp windowId="w1" />)

    await userEvent.click(within(favorites()).getByRole('button', { name: new RegExp(`^${plain.title}`) }))

    expect(cannotShow()).toBeInTheDocument()
    expect(frame()).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open in new tab ↗' }))
    expect(open).toHaveBeenCalledWith(plain.url, '_blank', 'noopener,noreferrer')
  })

  it('an embeddable bookmark renders a sandboxed iframe titled with the bookmark', async () => {
    extra.bookmarks = [demo]
    render(<SafariApp windowId="w1" />)

    await userEvent.click(within(favorites()).getByRole('button', { name: new RegExp(`^${demo.title}`) }))

    const framed = screen.getByTitle(demo.title)
    expect(framed.tagName).toBe('IFRAME')
    expect(framed).toHaveAttribute('src', demo.url)
    expect(framed).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms')
    expect(cannotShow()).not.toBeInTheDocument()
  })

  it('props.url opens directly in the first tab, and an unknown URL is treated as non-embeddable', () => {
    render(<SafariApp windowId="w1" props={{ url: 'https://unknown.example/' }} />)

    expect(screen.queryByRole('region', { name: 'Favorites' })).not.toBeInTheDocument()
    expect(cannotShow()).toBeInTheDocument()
    expect(frame()).toBeNull()
  })

  it('props.url with a javascript: scheme falls back to Favorites', () => {
    render(<SafariApp windowId="w1" props={{ url: 'javascript:alert(1)' }} />)

    expect(favorites()).toBeInTheDocument()
    expect(frame()).toBeNull()
  })

  it('address bar: invalid input shows the error and changes nothing; a valid URL shows the card', async () => {
    render(<SafariApp windowId="w1" />)

    await userEvent.type(address(), 'linkedin{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a web address starting with https://')
    expect(favorites()).toBeInTheDocument()

    await userEvent.clear(address())
    await userEvent.type(address(), 'https://example.org/{Enter}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(cannotShow()).toBeInTheDocument()
  })

  it('+ opens a Favorites tab and selects it; the close button removes a tab; the last tab cannot be closed', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(within(bookmarksBar()).getByRole('button', { name: plain.title }))
    expect(cannotShow()).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(favorites()).toBeInTheDocument()

    await userEvent.click(closeButton('Favorites'))
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(cannotShow()).toBeInTheDocument()

    expect(closeButton(plain.title)).toBeDisabled()
  })

  it('tabs sit in a tablist, and the active page is in a tabpanel labelled by its tab', () => {
    render(<SafariApp windowId="w1" />)

    const tab = screen.getByRole('tab', { name: 'Favorites' })
    expect(tab.closest('[role="tablist"]')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'Favorites' })).toBeInTheDocument()
  })

  it('the bookmarks bar shows bookmark titles; clicking navigates the current tab', async () => {
    render(<SafariApp windowId="w1" />)

    expect(within(bookmarksBar()).getAllByRole('button')).toHaveLength(bookmarks.length)
    await userEvent.click(within(bookmarksBar()).getByRole('button', { name: plain.title }))

    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(cannotShow()).toBeInTheDocument()
  })
})

describe('Safari tablist keyboard', () => {
  it('only the selected tab is in the tab order (roving tabindex)', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))

    const [first, second] = screen.getAllByRole('tab')
    expect(first).toHaveAttribute('tabindex', '-1')
    expect(second).toHaveAttribute('tabindex', '0')
  })

  it('ArrowRight, ArrowLeft, Home and End select and focus tabs, with wrap-around', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const [first, second] = screen.getAllByRole('tab')

    await userEvent.click(first)
    expect(first).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveFocus()

    await userEvent.keyboard('{End}')
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    expect(second).toHaveFocus()
  })

  it('New tab sits outside the tablist; the mouse-only close buttons are aria-hidden and not tabbable', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const tablist = screen.getByRole('tablist')

    expect(tablist.contains(screen.getByRole('button', { name: 'New tab' }))).toBe(false)
    expect(within(tablist).getAllByRole('tab')).toHaveLength(2)
    // getByRole skips aria-hidden subtrees, so the close buttons are found by label in the DOM.
    const closeButtons = tablist.querySelectorAll<HTMLButtonElement>('button[aria-label^="Close "]')
    expect(closeButtons).toHaveLength(2)
    for (const close of closeButtons) {
      expect(close).toHaveAttribute('aria-hidden', 'true')
      expect(close).toHaveAttribute('tabindex', '-1')
    }
  })

  it('Delete on a focused tab closes it and focuses the neighbour', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const [first, second] = screen.getAllByRole('tab')

    await userEvent.click(second)
    await userEvent.keyboard('{Delete}')

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0]).toBe(first)
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveFocus()
  })

  it('Backspace also closes the focused tab', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const [first, second] = screen.getAllByRole('tab')

    await userEvent.click(first)
    await userEvent.keyboard('{Backspace}')

    expect(screen.getAllByRole('tab')).toEqual([second])
    expect(second).toHaveFocus()
  })

  it('Delete does nothing on the last remaining tab', async () => {
    render(<SafariApp windowId="w1" />)
    const only = screen.getByRole('tab')

    await userEvent.click(only)
    await userEvent.keyboard('{Delete}')

    expect(screen.getAllByRole('tab')).toEqual([only])
    expect(only).toHaveFocus()
  })

  it('arrow keys pressed on a non-tab child of the tablist do not change the selection', async () => {
    render(<SafariApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'New tab' }))
    const [first, second] = screen.getAllByRole('tab')
    const close = screen.getByRole('tablist').querySelector<HTMLButtonElement>('button[aria-label="Close Favorites"]') as HTMLButtonElement

    close.focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
  })
})

describe('Safari framing rule', () => {
  beforeEach(() => {
    extra.bookmarks = [demo]
  })

  it('frames a deeper path on the embeddable origin', async () => {
    render(<SafariApp windowId="w1" />)
    await go('https://demo.example/docs/page')

    expect(frame()).toHaveAttribute('src', 'https://demo.example/docs/page')
    expect(cannotShow()).not.toBeInTheDocument()
  })

  it('frames a typed URL on the embeddable origin', async () => {
    render(<SafariApp windowId="w1" />)
    await go('https://demo.example/')

    expect(frame()).toHaveAttribute('src', 'https://demo.example/')
  })

  it.each([
    'http://demo.example/',
    'https://demo.example:8443/',
    'https://sub.demo.example/',
    'https://demo.example@evil.com/',
    'https://demo.example.evil.com/',
  ])('does not frame %s', async (url) => {
    render(<SafariApp windowId="w1" />)
    await go(url)

    expect(frame()).toBeNull()
    expect(cannotShow()).toBeInTheDocument()
  })

  it("never frames bymaxOS's own origin, even when a bookmark marks it embeddable", async () => {
    extra.bookmarks = [{ id: 'self', title: 'Self', url: `${window.location.origin}/`, embeddable: true }]
    render(<SafariApp windowId="w1" />)
    await go(`${window.location.origin}/page`)

    expect(frame()).toBeNull()
    expect(cannotShow()).toBeInTheDocument()
  })

  it('Reload is absent without an iframe and present while one is shown', async () => {
    render(<SafariApp windowId="w1" />)
    expect(reload()).toBeNull()

    await go('https://example.org/')
    expect(reload()).toBeNull()

    await go('https://demo.example/')
    expect(reload()).toBeInTheDocument()
  })
})
