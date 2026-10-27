import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { getContent } from '../../content'
import { resetSystem, useSystem } from '../../system/store'
import '../registry'
import TextEditApp from './TextEdit'

beforeEach(() => {
  resetSystem()
})

afterEach(() => {
  cleanup()
})

describe('TextEdit', () => {
  it('renders the document body for a fileId', () => {
    render(<TextEditApp windowId="w1" props={{ fileId: 'doc-hello' }} />)
    expect(screen.getByRole('heading', { name: getContent().profile.headline })).toBeInTheDocument()
  })

  it('sets the window title to the file name', () => {
    const windowId = useSystem.getState().openApp('textedit', { fileId: 'doc-hello' }) as string
    render(<TextEditApp windowId={windowId} props={{ fileId: 'doc-hello' }} />)
    const win = useSystem.getState().wm.windows.find((w) => w.id === windowId)
    expect(win?.title).toBe('Hello.md')
  })

  it('shows Not configured yet for an unknown fileId', () => {
    render(<TextEditApp windowId="w1" props={{ fileId: 'nope' }} />)
    expect(screen.getByText('Not configured yet')).toBeInTheDocument()
  })

  it('renders work files', () => {
    const first = getContent().experience[0]
    render(<TextEditApp windowId="w1" props={{ fileId: `work-${first.id}` }} />)
    expect(screen.getByRole('heading', { name: `${first.role} — ${first.company}` })).toBeInTheDocument()
  })
})
