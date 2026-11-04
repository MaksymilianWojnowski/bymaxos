import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Plus, Trash2 } from 'lucide-react'
import { getContent } from '../../content'
import { copyText } from '../../lib/clipboard'
import { useWindowCommands } from '../../system/commands'
import { useShell } from '../../system/shell'
import { KEYS, safeStorage } from '../../system/storage'
import { useSystem } from '../../system/store'
import { NavStack } from '../../ui/NavStack'
import { Sheet } from '../../ui/Sheet'
import type { AppProps } from '../types'
import { useOpenProps } from '../useOpenProps'
import {
  addNote,
  deleteNote,
  editNote,
  emptyStoredNotes,
  formatNoteDay,
  localDay,
  mergeNotes,
  NOTES_FOLDER,
  parseStoredNotes,
  previewLine,
  type StoredNotes,
} from './notesState'

const ICON_BUTTON =
  'grid h-7 w-7 place-items-center rounded-[4px] text-text-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent-link phone:h-11 phone:w-11 dark:hover:bg-white/10'
const TEXT_BUTTON =
  'rounded-[6px] px-2 py-0.5 text-accent-link underline focus-visible:ring-2 focus-visible:ring-accent-link phone:min-h-11'
const FIELD = 'bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-link'
// Selected rows fill with accent-strong, so the ring gets a gap of window colour to stand off from the fill.
const ROW_FOCUS = 'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-window focus-visible:ring-accent-link'

type Field = 'title' | 'body'
type TextField = HTMLInputElement | HTMLTextAreaElement

export default function NotesApp({ windowId, props }: AppProps) {
  const notify = useSystem((s) => s.notify)
  const [stored, setStored] = useState<StoredNotes>(() =>
    parseStoredNotes(safeStorage.get<unknown>('local', KEYS.notes, null)),
  )
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof props?.item === 'string' ? props.item : null,
  )
  const [query, setQuery] = useState('')
  const [confirming, setConfirming] = useState(false)
  // Phones show one pane at a time; the editor is the detail that slides over the list.
  const [detailOpen, setDetailOpen] = useState(false)
  const shell = useShell()

  const titleRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLButtonElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  // Edit commands act on the field the visitor last used; the body is the default.
  const lastField = useRef<Field>('body')
  const focusBody = useRef(false)
  const caret = useRef<{ field: Field; pos: number } | null>(null)

  const notes = useMemo(() => mergeNotes(getContent().notes, stored), [stored])
  const current = notes.find((n) => n.id === selectedId) ?? notes[0]

  // Notes is a single window: a note from Spotlight arrives as new props and must be selected.
  useOpenProps(props, (p) => {
    const itemId = typeof p.item === 'string' ? p.item : undefined
    if (itemId !== undefined && notes.some((n) => n.id === itemId)) {
      setSelectedId(itemId)
      setQuery('')
      setDetailOpen(true)
    }
  })

  const q = query.trim().toLowerCase()
  const visible = q
    ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    : notes

  // Every change is written straight to localStorage; there is no separate save step.
  const commit = (next: StoredNotes) => {
    setStored(next)
    safeStorage.set('local', KEYS.notes, next)
  }

  const change = (patch: { title?: string; body?: string }) => {
    if (!current) return
    commit(
      editNote(
        stored,
        current.id,
        { title: patch.title ?? current.title, body: patch.body ?? current.body },
        localDay(),
      ),
    )
  }

  const newNote = () => {
    const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    commit(addNote(stored, id, localDay()))
    setQuery('')
    focusBody.current = true
    setSelectedId(id)
    setDetailOpen(true)
  }

  const remove = () => {
    if (!current) return
    if (shell === 'mobile') {
      // The editor goes inert as it closes, so focus can only move to the list after that commits.
      flushSync(() => {
        commit(deleteNote(stored, current.id))
        setDetailOpen(false)
      })
      // A tap-focused search field would pop the iPhone keyboard over the list.
      newRef.current?.focus()
      return
    }
    commit(deleteNote(stored, current.id))
  }

  const restoreOriginals = () => {
    safeStorage.remove('local', KEYS.notes)
    setStored(emptyStoredNotes())
    setConfirming(false)
  }

  const activeField = (): TextField | null =>
    lastField.current === 'title' ? titleRef.current : bodyRef.current

  const copySelection = async () => {
    const field = activeField()
    if (!field) return
    const text = field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)
    if (text === '') return
    if (!(await copyText(text))) {
      notify('Notes', "Couldn't copy — select the text and copy it manually.")
    }
  }

  const paste = async () => {
    const field = activeField()
    if (!field || !current) return
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      notify('Notes', "Paste isn't available here — use ⌘V.")
      return
    }
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? start
    const value = field.value.slice(0, start) + text + field.value.slice(end)
    caret.current = { field: lastField.current, pos: start + text.length }
    change(lastField.current === 'title' ? { title: value } : { body: value })
  }

  const selectAll = () => activeField()?.select()

  useWindowCommands(windowId, {
    'notes.newNote': newNote,
    'edit.copy': copySelection,
    'edit.paste': paste,
    'edit.selectAll': selectAll,
  })

  // Runs after the render that inserted text, so the caret lands after the pasted text.
  useLayoutEffect(() => {
    const c = caret.current
    if (!c) return
    caret.current = null
    const el = c.field === 'title' ? titleRef.current : bodyRef.current
    el?.focus()
    el?.setSelectionRange(c.pos, c.pos)
  })

  useEffect(() => {
    if (!focusBody.current) return
    focusBody.current = false
    bodyRef.current?.focus()
  }, [selectedId])

  const newButton = (
    <button
      ref={newRef}
      type="button"
      aria-label="New Note"
      title="New Note"
      onClick={newNote}
      className={ICON_BUTTON}
    >
      <Plus className="h-4 w-4" aria-hidden />
    </button>
  )

  const deleteButton = (
    <button
      type="button"
      aria-label="Delete note"
      title="Delete note"
      onClick={remove}
      disabled={!current}
      className={`${ICON_BUTTON} disabled:opacity-40`}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  )

  // On a phone the highlight means "open in the editor", so no row is marked until one is open.
  const highlightId = shell === 'mobile' && !detailOpen ? undefined : current?.id

  const list = (
    <>
      <div className="p-2">
        <input
          type="search"
          aria-label="Search notes"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[6px] border border-black/15 bg-window px-2 py-1 text-text-1 placeholder:text-text-2 focus-visible:ring-2 focus-visible:ring-accent-link phone:min-h-11 dark:border-white/15"
        />
      </div>
      <ul aria-label="Notes" className="min-h-0 flex-1 overflow-auto px-2 pb-2">
        {visible.map((n) => {
          const selected = n.id === highlightId
          const muted = selected ? 'text-white' : 'text-text-2'
          const preview = previewLine(n.body)
          return (
            <li key={n.id}>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => {
                  setSelectedId(n.id)
                  setDetailOpen(true)
                }}
                className={`flex w-full flex-col gap-0.5 rounded-[6px] px-2 py-1.5 text-left phone:min-h-11 ${ROW_FOCUS} ${
                  selected ? 'bg-accent-strong text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span className="truncate font-semibold">{n.title || 'Untitled'}</span>
                <span className={`flex min-w-0 gap-2 ${muted}`}>
                  {n.updated && <span className="shrink-0">{formatNoteDay(n.updated)}</span>}
                  <span className="truncate">{preview}</span>
                </span>
              </button>
            </li>
          )
        })}
        {visible.length === 0 && <li className="px-2 py-1 text-text-2">{q ? 'No matching notes' : 'No notes'}</li>}
      </ul>
    </>
  )

  const editor = current ? (
    <>
      <input
        ref={titleRef}
        aria-label="Note title"
        value={current.title}
        onFocus={() => (lastField.current = 'title')}
        onChange={(e) => change({ title: e.target.value })}
        className={`${FIELD} px-4 pb-1 pt-3 text-[18px] font-semibold phone:min-h-11`}
      />
      <textarea
        ref={bodyRef}
        aria-label="Note body"
        value={current.body}
        onFocus={() => (lastField.current = 'body')}
        onChange={(e) => change({ body: e.target.value })}
        className={`${FIELD} min-h-0 flex-1 resize-none px-4 pb-4 pt-1`}
      />
    </>
  ) : (
    <p className="p-4 text-text-2">No note selected</p>
  )

  const footer = (
    <div className="flex items-center justify-between gap-3 border-t border-black/10 px-3 py-1.5 text-text-2 dark:border-white/15">
      <span>Your edits stay on this device.</span>
      <button type="button" onClick={() => setConfirming(true)} className={TEXT_BUTTON}>
        Restore originals
      </button>
    </div>
  )

  const sheet = confirming && (
    <Sheet title="Restore original notes?" onClose={() => setConfirming(false)}>
      <p>This discards your edits and any notes you added on this device.</p>
      <div className="flex justify-start">
        <button
          type="button"
          onClick={restoreOriginals}
          className="rounded-[6px] bg-accent-strong px-3 py-1 text-white phone:min-h-11"
        >
          Restore
        </button>
      </div>
    </Sheet>
  )

  if (shell === 'mobile') {
    return (
      <div className="h-full min-h-0 bg-window font-sans text-[13px] text-text-1">
        <NavStack
          title="Notes"
          listActions={newButton}
          list={
            <>
              {list}
              {footer}
            </>
          }
          open={detailOpen}
          detailTitle={current?.title || 'Untitled'}
          detailActions={deleteButton}
          onBack={() => setDetailOpen(false)}
          detail={<div className="flex h-full min-h-0 flex-col">{editor}</div>}
        />
        {sheet}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-window font-sans text-[13px] text-text-1">
      <div className="flex items-center gap-1 border-b border-black/10 px-2 py-1 dark:border-white/15">
        {newButton}
        {deleteButton}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-[160px] shrink-0 overflow-auto border-r border-black/10 p-2 dark:border-white/15">
          <ul aria-label="Folders">
            <li
              aria-current="true"
              className="flex items-center justify-between rounded-[6px] bg-accent-strong px-2 py-1 text-white"
            >
              <span>{NOTES_FOLDER}</span>
              <span>{notes.length}</span>
            </li>
          </ul>
        </div>

        <div className="flex w-[240px] shrink-0 flex-col border-r border-black/10 dark:border-white/15">{list}</div>

        <div className="flex min-w-0 flex-1 flex-col">{editor}</div>
      </div>

      {footer}

      {sheet}
    </div>
  )
}
