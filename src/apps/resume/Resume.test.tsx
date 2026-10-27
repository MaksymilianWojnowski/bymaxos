import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { formatRange } from '../../lib/format'
import { dispatch, installSystemCommands } from '../../system/commands'
import { resetSystem, useSystem } from '../../system/store'
import '../registry'
import ResumeApp from './Resume'

const pdf = vi.hoisted(() => ({ pdfUrl: undefined as string | undefined }))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (...args: Parameters<typeof actual.getContent>) => {
      const content = actual.getContent(...args)
      return pdf.pdfUrl
        ? { ...content, site: { ...content.site, resume: { pdfUrl: pdf.pdfUrl } } }
        : content
    },
  }
})

const { profile, links, experience } = getContent()
const linkedinUrl = links.find((l) => l.id === 'linkedin')!.url
const githubUrl = links.find((l) => l.id === 'github')!.url

let disposeCommands: () => void
let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetSystem()
  disposeCommands = installSystemCommands()
  open = vi.spyOn(window, 'open').mockReturnValue(null)
  vi.spyOn(window, 'print').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  disposeCommands()
  vi.restoreAllMocks()
  pdf.pdfUrl = undefined
})

describe('Resume', () => {
  it('renders all sections in order', () => {
    const { container } = render(<ResumeApp windowId="w1" />)
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)
    expect(headings).toEqual(['About', 'Experience', 'Skills', 'Education', 'Projects', 'Languages'])
    expect(container.querySelector('h1')?.textContent).toBe(profile.name)
  })

  it('experience shows role, company and date range', () => {
    const { container } = render(<ResumeApp windowId="w1" />)
    const first = experience[0]
    const row = within(container).getByText(formatRange(first.start, first.end), { exact: false })
    expect(row.parentElement?.textContent).toContain(first.role)
    expect(row.parentElement?.textContent).toContain(first.company)
  })

  it('Download PDF appears only when resume.pdfUrl is set', () => {
    const { unmount } = render(<ResumeApp windowId="w1" />)
    expect(screen.queryByRole('link', { name: 'Download PDF' })).not.toBeInTheDocument()
    unmount()

    pdf.pdfUrl = 'resume.pdf'
    render(<ResumeApp windowId="w1" />)
    const link = screen.getByRole('link', { name: 'Download PDF' })
    expect(link).toHaveAttribute('href', `${import.meta.env.BASE_URL}resume.pdf`)
    expect(link).toHaveAttribute('download')
  })

  it('uses an absolute pdfUrl as-is', () => {
    pdf.pdfUrl = 'https://example.com/cv.pdf'
    render(<ResumeApp windowId="w1" />)
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      'https://example.com/cv.pdf',
    )
  })

  it('Print calls window.print', async () => {
    render(<ResumeApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('resume.print dispatched to the focused window calls window.print', () => {
    const windowId = useSystem.getState().openApp('resume') as string
    render(<ResumeApp windowId={windowId} />)
    act(() => {
      dispatch({ type: 'resume.print' })
    })
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('Email opens Mail and Book a call opens Calendar', async () => {
    render(<ResumeApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'Email' }))
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'mail')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Book a call' }))
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'calendar')).toHaveLength(1)
  })

  it('LinkedIn and GitHub open in a new tab', async () => {
    render(<ResumeApp windowId="w1" />)
    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }))
    expect(open).toHaveBeenLastCalledWith(linkedinUrl, '_blank', 'noopener,noreferrer')
    await userEvent.click(screen.getByRole('button', { name: 'GitHub' }))
    expect(open).toHaveBeenLastCalledWith(githubUrl, '_blank', 'noopener,noreferrer')
  })

  it('renders a print-only copy into document.body', () => {
    const { unmount } = render(<ResumeApp windowId="w1" />)
    expect(document.body.querySelector('.print-only h1')?.textContent).toBe(profile.name)
    unmount()
    expect(document.body.querySelector('.print-only')).toBeNull()
  })
})
