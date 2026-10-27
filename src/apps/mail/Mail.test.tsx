import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { buildMailto } from '../../lib/mailto'
import { resetSystem, useSystem } from '../../system/store'
import MailApp from './Mail'

const email = getContent().profile.email

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

let open: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  resetSystem()
  open = vi.spyOn(window, 'open').mockReturnValue(null)
  setClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe('Mail', () => {
  it('shows the profile email as a read-only To field', () => {
    render(<MailApp windowId="w1" />)
    const to = screen.getByRole('textbox', { name: 'To' })
    expect(to).toHaveValue(email)
    expect(to).toHaveAttribute('readOnly')
  })

  it('shows both errors and opens nothing when subject and message are blank', async () => {
    render(<MailApp windowId="w1" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(screen.getByText('Add a subject.')).toBeInTheDocument()
    expect(screen.getByText('Write a message.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('aria-invalid', 'true')
    expect(open).not.toHaveBeenCalled()
  })

  it('opens the mailto draft in the same tab', async () => {
    render(<MailApp windowId="w1" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'Hello')
    await userEvent.type(screen.getByRole('textbox', { name: 'Your name' }), 'Ann')
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(open).toHaveBeenCalledWith(
      buildMailto({ to: email, subject: 'Hello', body: 'Hi\n\n— Ann' }),
      '_self',
    )
  })

  it('explains in a sheet and a banner that nothing was sent', async () => {
    render(<MailApp windowId="w1" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'Hello')
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    const dialog = screen.getByRole('dialog', { name: 'Finish in your email app' })
    expect(dialog).toHaveTextContent('nothing has been sent')
    expect(useSystem.getState().banners).toEqual([
      expect.objectContaining({
        title: 'Mail',
        body: 'Draft opened in your email app — nothing has been sent yet.',
      }),
    ])
  })

  it('reports a copied address honestly', async () => {
    render(<MailApp windowId="w1" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'Hello')
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(useSystem.getState().banners.at(-1)?.body).toBe('Email address copied.')
  })

  it('reports a failed copy honestly', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<MailApp windowId="w1" />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject' }), 'Hello')
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    await userEvent.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(useSystem.getState().banners.at(-1)?.body).toBe(
      "Couldn't copy the address — select it and copy it manually.",
    )
  })
})
