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
    expect(document.querySelector('iframe')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Open in new tab ↗' }))
    expect(open).toHaveBeenCalledWith(plain.url, '_blank', 'noopener,noreferrer')
  })

  it('an embeddable bookmark renders a sandboxed iframe titled with the bookmark', async () => {
    extra.bookmarks = [demo]
    render(<SafariApp windowId="w1" />)

    await userEvent.click(within(favorites()).getByRole('button', { name: new RegExp(`^${demo.title}`) }))

    const frame = screen.getByTitle(demo.title)
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', demo.url)
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms')
    expect(cannotShow()).not.toBeInTheDocument()
  })

  it('props.url opens directly in the first tab, and an unknown URL is treated as non-embeddable', () => {
    render(<SafariApp windowId="w1" props={{ url: 'https://unknown.example/' }} />)

    expect(screen.queryByRole('region', { name: 'Favorites' })).not.toBeInTheDocument()
    expect(cannotShow()).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
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

    await userEvent.click(screen.getByRole('button', { name: 'Close Favorites' }))
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(cannotShow()).toBeInTheDocument()

    expect(screen.getByRole('button', { name: `Close ${plain.title}` })).toBeDisabled()
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
