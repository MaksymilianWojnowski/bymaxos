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

// A real calendar day as YYYY-MM-DD; Feb 30 and friends are rejected by the round trip.
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

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
        isDay(e.updated)
      ) {
        edits[id] = { title: e.title, body: e.body, updated: e.updated }
      }
    }
  }

  // A malformed `updated` drops the whole note: it would otherwise break the list's date line.
  const added: Note[] = Array.isArray(raw.added)
    ? raw.added.flatMap((n): Note[] => {
        if (
          !isRecord(n) ||
          typeof n.id !== 'string' ||
          typeof n.title !== 'string' ||
          typeof n.body !== 'string' ||
          (n.updated !== undefined && !isDay(n.updated))
        ) {
          return []
        }
        return [
          {
            id: n.id,
            folder: NOTES_FOLDER,
            title: n.title,
            body: n.body,
            ...(isDay(n.updated) ? { updated: n.updated } : {}),
          },
        ]
      })
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
  // Added notes come first, so on a same-day tie (the stable sort) a new note stays above an edited seed note.
  return [...added, ...seeded].sort(byUpdatedDesc)
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
  if (!isDay(day)) return ''
  const [year, month, date] = day.split('-').map(Number)
  return DAY.format(new Date(year, month - 1, date))
}
