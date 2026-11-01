import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { APPS } from '../../apps/registry'
import { getContent } from '../../content'
import { buildIndex, rank } from '../../system/search'
import { resetSystem, useSystem } from '../../system/store'
import { MobileSearch } from './MobileSearch'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSystem()
  useSystem.setState({ locked: false })
})

afterEach(() => {
  cleanup()
  resetSystem()
})

const field = () => screen.getByRole('combobox', { name: 'Search' })
const openedApps = () => useSystem.getState().wm.windows.map((w) => w.appId)

describe('MobileSearch', () => {
  it('full-screen sheet with a focused search field named "Search" and a Cancel button', () => {
    render(<MobileSearch onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    expect(field()).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('typing lists ranked results (same items as Spotlight)', () => {
    render(<MobileSearch onClose={vi.fn()} />)
    fireEvent.change(field(), { target: { value: 'mail' } })
    const expected = rank(buildIndex(getContent(), APPS), 'mail').map((item) => item.title)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(expected.length)
    options.forEach((option, i) => expect(option).toHaveTextContent(expected[i]))
  })

  it('choosing an app result calls openMobileApp(appId)', () => {
    const onClose = vi.fn()
    render(<MobileSearch onClose={onClose} />)
    fireEvent.change(field(), { target: { value: 'mail' } })
    fireEvent.click(screen.getByRole('option', { name: 'Mail' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(openedApps()).toEqual(['mail'])
  })

  it('choosing a content result (note) opens its app with its props via openMobileApp', () => {
    render(<MobileSearch onClose={vi.fn()} />)
    fireEvent.change(field(), { target: { value: 'working style' } })
    // The option's name includes its preview line, so match the title as a prefix.
    fireEvent.click(screen.getByRole('option', { name: /^Working style/ }))
    const notes = useSystem.getState().wm.windows.find((w) => w.appId === 'notes')
    expect(notes?.props).toEqual({ item: 'working-style' })
  })

  it('Cancel and Escape close it', () => {
    const onClose = vi.fn()
    render(<MobileSearch onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Search' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('choosing a document result opens TextEdit with its fileId, which is reachable on mobile', () => {
    render(<MobileSearch onClose={vi.fn()} />)
    fireEvent.change(field(), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('option', { name: /^Hello\.md/ }))
    const textedit = useSystem.getState().wm.windows.find((w) => w.appId === 'textedit')
    expect(textedit?.props).toEqual({ fileId: 'doc-hello' })
  })

  it('lists no result for a hidden-on-mobile app such as Trash', () => {
    render(<MobileSearch onClose={vi.fn()} />)
    fireEvent.change(field(), { target: { value: 'trash' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('No Results')
  })

  it('closing returns focus to the element that opened it', () => {
    render(<button type="button">Search pill</button>)
    const opener = screen.getByRole('button', { name: 'Search pill' })
    opener.focus()
    const { unmount } = render(<MobileSearch onClose={vi.fn()} />)
    expect(field()).toHaveFocus()
    unmount()
    expect(opener).toHaveFocus()
  })
})
