import type { Note } from '../../content/types'

export const NOTES_FOLDER = 'Notes'

// Only the visitor's changes are stored; the seed notes stay in content.
export interface StoredNotes {
  edits: Record<string, { title: string; body: string; updated: string }>
  added: Note[]
  deleted: string[]
}

export type VisibleNote = Note & { local: boolean }

export function emptyStoredNotes(): StoredNotes {
  return { edits: {}, added: [], deleted: [] }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// Reads whatever localStorage returned and keeps only well-formed entries.
export function parseStoredNotes(raw: unknown): StoredNotes {
  if (!isRecord(raw)) return emptyStoredNotes()

  const edits: StoredNotes['edits'] = {}
  if (isRecord(raw.edits)) {
    for (const [id, e] of Object.entries(raw.edits)) {
      if (
        isRecord(e) &&
        typeof e.title === 'string' &&
        typeof e.body === 'string' &&
        typeof e.updated === 'string'
      ) {
        edits[id] = { title: e.title, body: e.body, updated: e.updated }
      }
    }
  }

  const added: Note[] = Array.isArray(raw.added)
    ? raw.added.flatMap((n): Note[] =>
        isRecord(n) && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.body === 'string'
          ? [
              {
                id: n.id,
                folder: NOTES_FOLDER,
                title: n.title,
                body: n.body,
                ...(typeof n.updated === 'string' ? { updated: n.updated } : {}),
              },
            ]
          : [],
      )
    : []

  const deleted = Array.isArray(raw.deleted)
    ? raw.deleted.filter((id): id is string => typeof id === 'string')
    : []

  return { edits, added, deleted }
}

// Undated seed notes sort last, keeping their seed order (the sort is stable).
const byUpdatedDesc = (a: Note, b: Note): number => {
  if (a.updated === b.updated) return 0
  if (!a.updated) return 1
  if (!b.updated) return -1
  return b.updated.localeCompare(a.updated)
}

export function mergeNotes(seed: Note[], stored: StoredNotes): VisibleNote[] {
  const hidden = new Set(stored.deleted)
  const seeded: VisibleNote[] = seed
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      const edit = Object.hasOwn(stored.edits, n.id) ? stored.edits[n.id] : undefined
      return edit ? { ...n, ...edit, local: true } : { ...n, local: false }
    })
  const added: VisibleNote[] = stored.added
    .filter((n) => !hidden.has(n.id))
    .map((n) => ({ ...n, local: true }))
  return [...seeded, ...added].sort(byUpdatedDesc)
}

// Edits to a visitor note rewrite its own entry; edits to a seed note go to `edits`.
export function editNote(
  stored: StoredNotes,
  id: string,
  patch: { title: string; body: string },
  day: string,
): StoredNotes {
  if (stored.added.some((n) => n.id === id)) {
    return {
      ...stored,
      added: stored.added.map((n) => (n.id === id ? { ...n, ...patch, updated: day } : n)),
    }
  }
  return { ...stored, edits: { ...stored.edits, [id]: { ...patch, updated: day } } }
}

// New notes go first so they sort to the top.
export function addNote(stored: StoredNotes, id: string, day: string): StoredNotes {
  const note: Note = { id, folder: NOTES_FOLDER, title: 'New Note', body: '', updated: day }
  return { ...stored, added: [note, ...stored.added] }
}

// A visitor note is removed for good; a seed note is only hidden (Restore originals brings it back).
export function deleteNote(stored: StoredNotes, id: string): StoredNotes {
  if (stored.added.some((n) => n.id === id)) {
    return { ...stored, added: stored.added.filter((n) => n.id !== id) }
  }
  return stored.deleted.includes(id) ? stored : { ...stored, deleted: [...stored.deleted, id] }
}

// First body line that is not a heading, list marker removed: shown in the list and in Spotlight.
export function previewLine(body: string): string {
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line && !line.startsWith('#')) return line.replace(/^-\s+/, '')
  }
  return ''
}

// Local calendar day as YYYY-MM-DD.
export function localDay(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Parses the date as local time: new Date('YYYY-MM-DD') would read it as UTC and can show the day before.
export function formatNoteDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return DAY.format(new Date(year, month - 1, date))
}
