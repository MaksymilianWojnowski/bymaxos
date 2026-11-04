import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { dispatch } from '../../system/commands'
import { mockPhone } from '../../test/mockPhone'
import { QUICK_COMMANDS, runCommand } from './commands'
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
    expect(log().textContent).toMatch(/^Session started .* — type help/)
    expect(log().textContent).not.toContain('Last login')

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

  it('makes the output keyboard-focusable so overflowing output can be scrolled', () => {
    render(<TerminalApp />)
    expect(log()).toHaveAttribute('tabindex', '0')
  })

  describe('quick-command chips', () => {
    const chips = () => screen.queryByRole('toolbar', { name: 'Quick commands' })
    const chip = (name: string) => screen.getByRole('button', { name })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('phone: chips sit between the output and the input', () => {
      mockPhone()
      render(<TerminalApp />)
      expect(chips()).toBeInTheDocument()
      const bar = chips() as HTMLElement
      expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(QUICK_COMMANDS)
      expect(log().compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(bar.compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('desktop: no chips', () => {
      render(<TerminalApp />)
      expect(chips()).not.toBeInTheDocument()
    })

    it('phone: tapping a chip runs it, echoes it and adds it to history', async () => {
      mockPhone()
      render(<TerminalApp />)
      await userEvent.click(chip('whoami'))
      const text = log().textContent ?? ''
      expect(text).toContain('maks@bymaxos ~ % whoami')
      expect(text).toContain(profile.name)
      await userEvent.click(input())
      await userEvent.keyboard('{ArrowUp}')
      expect(input()).toHaveValue('whoami')
    })

    it('phone: the clear chip empties the output', async () => {
      mockPhone()
      render(<TerminalApp />)
      await userEvent.click(chip('whoami'))
      await userEvent.click(chip('clear'))
      expect(log().textContent).toBe('')
    })

    it('every quick command is a real command', () => {
      for (const name of QUICK_COMMANDS) {
        const { lines } = runCommand(name, { cwd: 'root', history: [] })
        expect(lines.join('\n'), name).not.toMatch(/command not found/)
      }
    })

    it('phone: a typed draft survives a chip tap', async () => {
      mockPhone()
      render(<TerminalApp />)
      await userEvent.type(input(), 'ab')
      await userEvent.click(chip('whoami'))
      expect(input()).toHaveValue('ab')
    })
  })
})
