import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../../content'
import { dispatch } from '../../system/commands'
import { KEYS } from '../../system/storage'
import { resetSystem, useSystem } from '../../system/store'
import '../registry'
import NotesApp from './Notes'

const seed = getContent().notes
const [workingStyle, lookingFor] = seed

// Opens a real window so the command bus resolves the focused Notes window.
function openNotes(props?: Record<string, unknown>) {
  const windowId = useSystem.getState().openApp('notes', props) as string
  return render(<NotesApp windowId={windowId} props={props} />)
}

const titleField = () => screen.getByRole('textbox', { name: 'Note title' })
const bodyField = () => screen.getByRole('textbox', { name: 'Note body' }) as HTMLTextAreaElement

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

beforeEach(() => {
  window.localStorage.clear()
  resetSystem()
})

afterEach(() => {
  cleanup()
  delete (navigator as { clipboard?: unknown }).clipboard
  vi.useRealTimers()
})

describe('Notes', () => {
  it('shows three panes: folders, list and editor; the first note is selected', () => {
    openNotes()
    expect(screen.getByRole('list', { name: 'Folders' })).toHaveTextContent('Notes')
    expect(screen.getByRole('list', { name: 'Notes' })).toBeInTheDocument()
    expect(titleField()).toHaveValue(workingStyle.title)
  })

  it('selects the note named by props.item', () => {
    openNotes({ item: 'looking-for' })
    expect(titleField()).toHaveValue(lookingFor.title)
  })

  it('renders the seed notes when stored edits have a corrupt updated date', () => {
    window.localStorage.setItem(
      KEYS.notes,
      JSON.stringify({
        edits: { 'working-style': { title: 'Broken', body: 'x', updated: 'foo' } },
        added: [{ id: 'bad', title: 'Bad', body: '', updated: 'foo' }],
        deleted: [],
      }),
    )
    openNotes()
    const list = screen.getByRole('list', { name: 'Notes' })
    expect(within(list).getByRole('button', { name: new RegExp(workingStyle.title) })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: /Bad|Broken/ })).not.toBeInTheDocument()
  })

  it('persists edits under KEYS.notes, survives a remount and shows the footer note', async () => {
    const user = userEvent.setup()
    const first = openNotes()
    await user.clear(bodyField())
    await user.type(bodyField(), 'Kept')
    expect(screen.getByText('Your edits stay on this device.')).toBeInTheDocument()
    const raw = JSON.parse(window.localStorage.getItem(KEYS.notes) ?? 'null')
    expect(raw.edits[workingStyle.id].body).toBe('Kept')
    first.unmount()

    openNotes()
    expect(bodyField()).toHaveValue('Kept')
  })

  it('New Note from the toolbar adds an empty note at the top and focuses its body', async () => {
    const user = userEvent.setup()
    openNotes()
    await user.click(screen.getByRole('button', { name: 'New Note' }))
    expect(titleField()).toHaveValue('New Note')
    expect(bodyField()).toHaveValue('')
    expect(bodyField()).toHaveFocus()
    expect(within(screen.getByRole('list', { name: 'Notes' })).getAllByRole('button')[0]).toHaveTextContent('New Note')
  })

  it('File > New Note (the command bus) adds a note too', async () => {
    openNotes()
    await act(async () => {
      dispatch({ type: 'notes.newNote' })
    })
    expect(titleField()).toHaveValue('New Note')
  })

  it('Delete removes a visitor note, and on a seed note it only hides it', async () => {
    const user = userEvent.setup()
    openNotes()
    await user.click(screen.getByRole('button', { name: 'New Note' }))
    await user.click(screen.getByRole('button', { name: 'Delete note' }))
    const list = screen.getByRole('list', { name: 'Notes' })
    expect(within(list).queryByRole('button', { name: /New Note/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: new RegExp(workingStyle.title) }))
    await user.click(screen.getByRole('button', { name: 'Delete note' }))
    expect(screen.queryByRole('button', { name: new RegExp(workingStyle.title) })).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(KEYS.notes) ?? 'null').deleted).toEqual([workingStyle.id])
  })

  it('Restore originals asks in a Sheet, then clears storage and shows the seed notes unchanged', async () => {
    const user = userEvent.setup()
    openNotes()
    await user.clear(bodyField())
    await user.type(bodyField(), 'Changed')
    await user.click(screen.getByRole('button', { name: 'Restore originals' }))

    const sheet = screen.getByRole('dialog')
    expect(window.localStorage.getItem(KEYS.notes)).not.toBeNull()
    await user.click(within(sheet).getByRole('button', { name: 'Restore' }))

    expect(window.localStorage.getItem(KEYS.notes)).toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bodyField()).toHaveValue(workingStyle.body)
  })

  it('Edit > Copy copies the editor selection through copyText', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard({ writeText })
    openNotes()
    const body = bodyField()
    body.setSelectionRange(0, 5)
    await act(async () => {
      dispatch({ type: 'edit.copy' })
    })
    expect(writeText).toHaveBeenCalledWith(body.value.slice(0, 5))
  })

  it('Edit > Copy shows a banner when the copy fails', async () => {
    stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    openNotes()
    bodyField().setSelectionRange(0, 3)
    await act(async () => {
      dispatch({ type: 'edit.copy' })
    })
    await waitFor(() =>
      expect(useSystem.getState().banners.map((b) => b.title)).toContain('Notes'),
    )
  })

  it('Edit > Select All selects the body', async () => {
    openNotes()
    await act(async () => {
      dispatch({ type: 'edit.selectAll' })
    })
    expect(bodyField().selectionStart).toBe(0)
    expect(bodyField().selectionEnd).toBe(bodyField().value.length)
  })

  it('Edit > Paste inserts clipboard text at the caret', async () => {
    stubClipboard({ readText: vi.fn().mockResolvedValue('XYZ') })
    openNotes()
    bodyField().setSelectionRange(0, 0)
    await act(async () => {
      dispatch({ type: 'edit.paste' })
    })
    await waitFor(() => expect(bodyField().value.startsWith('XYZ')).toBe(true))
  })

  it('Edit > Paste shows the ⌘V banner when the clipboard cannot be read', async () => {
    openNotes()
    await act(async () => {
      dispatch({ type: 'edit.paste' })
    })
    await waitFor(() =>
      expect(useSystem.getState().banners.map((b) => b.body)).toContain(
        "Paste isn't available here — use ⌘V.",
      ),
    )
  })

  it('search filters the list by title or body, case-insensitively', async () => {
    const user = userEvent.setup()
    openNotes()
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'LOOKING')
    const list = screen.getByRole('list', { name: 'Notes' })
    expect(within(list).getAllByRole('button')).toHaveLength(1)
    expect(within(list).getByRole('button', { name: new RegExp(lookingFor.title) })).toBeInTheDocument()
  })
})
