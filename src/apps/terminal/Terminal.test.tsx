import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { dispatch } from '../../system/commands'
import TerminalApp from './Terminal'

vi.mock('../../system/commands', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../system/commands')>()
  return { ...actual, dispatch: vi.fn(() => true) }
})

const { profile } = getContent()

beforeEach(() => {
  vi.mocked(dispatch).mockClear()
})

afterEach(() => {
  cleanup()
})

const input = () => screen.getByRole('textbox', { name: 'Terminal input' }) as HTMLInputElement
const log = () => screen.getByRole('log')

describe('Terminal', () => {
  it('shows a welcome line, then prints a command under its echoed prompt', async () => {
    render(<TerminalApp />)
    expect(log().textContent).toMatch(/Last login: .* on bymaxsh — type help/)

    await userEvent.type(input(), 'whoami{Enter}')

    const text = log().textContent ?? ''
    expect(text).toContain('maks@bymaxos ~ % whoami')
    expect(text.indexOf('maks@bymaxos ~ % whoami')).toBeLessThan(text.indexOf(profile.name))
    expect(input()).toHaveValue('')
  })

  it('walks the history with the arrow keys and returns to the draft', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'whoami{Enter}')
    await userEvent.type(input(), 'about{Enter}')

    await userEvent.type(input(), 'ls')
    await userEvent.keyboard('{ArrowUp}')
    expect(input()).toHaveValue('about')
    await userEvent.keyboard('{ArrowUp}')
    expect(input()).toHaveValue('whoami')
    await userEvent.keyboard('{ArrowDown}')
    expect(input()).toHaveValue('about')
    await userEvent.keyboard('{ArrowDown}')
    expect(input()).toHaveValue('ls')
  })

  it('Tab completes the command name', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'ne{Tab}')
    expect(input()).toHaveValue('neofetch')
  })

  it('cd changes the prompt to the folder name', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'cd work{Enter}')
    expect(screen.getByText('maks@bymaxos Work %')).toBeInTheDocument()
  })

  it('clear empties the screen', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'whoami{Enter}')
    await userEvent.type(input(), 'clear{Enter}')
    expect(log().textContent).toBe('')
  })

  it('Ctrl+L clears the screen', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'whoami{Enter}')
    fireEvent.keyDown(input(), { key: 'l', ctrlKey: true })
    expect(log().textContent).toBe('')
  })

  it('open mail dispatches the dock activation for Mail', async () => {
    render(<TerminalApp />)
    await userEvent.type(input(), 'open mail{Enter}')
    expect(dispatch).toHaveBeenCalledWith({ type: 'dock.activate', appId: 'mail' })
  })

  it('exposes the input by name and the output as a log region', () => {
    render(<TerminalApp />)
    expect(input()).toBeInTheDocument()
    expect(log()).toHaveAttribute('aria-label', 'Terminal output')
  })
})
