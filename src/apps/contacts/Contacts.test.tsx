import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { installSystemCommands } from '../../system/commands'
import { resetSystem, useSystem } from '../../system/store'
import '../registry'
import ContactsApp from './Contacts'

const { profile, links } = getContent()
const linkedinUrl = links.find((l) => l.id === 'linkedin')!.url
const githubUrl = links.find((l) => l.id === 'github')!.url

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

let disposeCommands: () => void
let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetSystem()
  disposeCommands = installSystemCommands()
  open = vi.spyOn(window, 'open').mockReturnValue(null)
  setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
})

afterEach(() => {
  cleanup()
  disposeCommands()
  vi.restoreAllMocks()
  delete (navigator as { clipboard?: unknown }).clipboard
  delete (navigator as { share?: unknown }).share
  delete (URL as { createObjectURL?: unknown }).createObjectURL
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL
})

describe('Contacts', () => {
  it('shows name, headline, email, location, LinkedIn and GitHub from content', () => {
    render(<ContactsApp />)
    expect(screen.getByRole('heading', { name: profile.name })).toBeInTheDocument()
    expect(screen.getByText(profile.headline)).toBeInTheDocument()
    expect(screen.getByText(profile.email)).toBeInTheDocument()
    expect(screen.getByText(profile.location)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: linkedinUrl })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: githubUrl })).toBeInTheDocument()
  })

  it('lists rows in the order email, LinkedIn, GitHub, location', () => {
    render(<ContactsApp />)
    const terms = Array.from(document.querySelectorAll('dt')).map((dt) => dt.textContent)
    expect(terms).toEqual(['email', 'LinkedIn', 'GitHub', 'location'])
  })

  it('Copy email copies and confirms', async () => {
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy email' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(profile.email)
    expect(useSystem.getState().banners.at(-1)?.body).toBe('Email copied.')
  })

  it('Copy failure is reported, not hidden', async () => {
    setClipboard(undefined)
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy email' }))
    expect(useSystem.getState().banners.at(-1)?.body).toBe(
      "Couldn't copy email — select it and copy it manually.",
    )
  })

  it('opens a profile link in a new tab', async () => {
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: linkedinUrl }))
    expect(open).toHaveBeenCalledWith(linkedinUrl, '_blank', 'noopener,noreferrer')
  })

  it('Download vCard creates a .vcf download', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    let downloaded = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download
    })

    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Download vCard' }))

    expect(downloaded).toBe(`${profile.name}.vcf`)
    const blob = (URL.createObjectURL as Mock).mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/vcard;charset=utf-8')
  })

  it('Share is shown only when navigator.share exists', async () => {
    const { unmount } = render(<ContactsApp />)
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument()
    unmount()

    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(share).toHaveBeenCalledWith({
      title: profile.name,
      text: `${profile.name} — ${profile.headline}\n${profile.email}`,
    })
  })

  it('a cancelled share shows no banner', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(share).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(useSystem.getState().banners).toEqual([])
  })

  it('Message opens Mail', async () => {
    render(<ContactsApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Message' }))
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'mail')).toHaveLength(1)
  })
})
