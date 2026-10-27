import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { installSystemCommands } from '../../system/commands'
import { resetSystem, useSystem } from '../../system/store'
import '../registry'
import CalendarApp from './Calendar'

const scheduling = vi.hoisted(() => ({
  value: { meetingTypes: [] } as {
    calUrl?: string
    meetingTypes: { id: string; title: string; minutes: number; description: string; slug: string }[]
  },
}))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (locale?: 'en') => {
      const content = actual.getContent(locale)
      return { ...content, site: { ...content.site, scheduling: scheduling.value } }
    },
  }
})

let disposeCommands: () => void
let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 11, 15))
  resetSystem()
  disposeCommands = installSystemCommands()
  open = vi.spyOn(window, 'open').mockReturnValue(null)
  scheduling.value = { meetingTypes: [] }
})

afterEach(() => {
  cleanup()
  disposeCommands()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Calendar', () => {
  it('shows the current month and marks today', () => {
    render(<CalendarApp />)
    expect(screen.getByRole('heading', { name: 'December 2026', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('15').closest('td')).toHaveAttribute('aria-current', 'date')
  })

  it('Next from December goes to January of the next year', async () => {
    render(<CalendarApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'January 2027', level: 2 })).toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toBeNull()
  })

  it('Today returns to the current month', async () => {
    render(<CalendarApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'November 2026', level: 2 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'December 2026', level: 2 })).toBeInTheDocument()
  })

  it('without calUrl offers email instead of booking', async () => {
    render(<CalendarApp />)
    expect(
      screen.getByText("Online booking isn't set up yet — email to arrange a time."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /min$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Book a call' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Email Maksymilian' }))
    expect(useSystem.getState().wm.windows.filter((w) => w.appId === 'mail')).toHaveLength(1)
  })

  it('with calUrl and meeting types, each type opens its Cal.com page', async () => {
    scheduling.value = {
      calUrl: 'https://cal.com/maks',
      meetingTypes: [{ id: 'intro', title: 'Intro call', minutes: 30, description: '', slug: 'intro' }],
    }
    render(<CalendarApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Intro call · 30 min' }))
    expect(open).toHaveBeenCalledWith('https://cal.com/maks/intro', '_blank', 'noopener,noreferrer')
  })

  it('strips a trailing slash from calUrl before joining a meeting type', async () => {
    scheduling.value = {
      calUrl: 'https://cal.com/maks/',
      meetingTypes: [{ id: 'intro', title: 'Intro call', minutes: 30, description: '', slug: 'intro' }],
    }
    render(<CalendarApp />)
    await userEvent.click(screen.getByRole('button', { name: 'Intro call · 30 min' }))
    expect(open).toHaveBeenCalledWith('https://cal.com/maks/intro', '_blank', 'noopener,noreferrer')
  })

  it('with calUrl and no types, a single Book a call opens calUrl', async () => {
    scheduling.value = { calUrl: 'https://cal.com/maks', meetingTypes: [] }
    render(<CalendarApp />)
    expect(screen.queryByText(/isn't set up yet/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Book a call' }))
    expect(open).toHaveBeenCalledWith('https://cal.com/maks', '_blank', 'noopener,noreferrer')
  })
})
