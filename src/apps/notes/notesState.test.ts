import { describe, expect, it } from 'vitest'
import { getContent } from '../../content'
import { emptyStoredNotes, localDay, mergeNotes, parseStoredNotes, previewLine } from './notesState'

const seed = getContent().notes

describe('parseStoredNotes', () => {
  it('returns empty defaults for anything that is not a stored-notes object', () => {
    for (const raw of [null, 'x', { edits: 5 }]) {
      expect(parseStoredNotes(raw)).toEqual({ edits: {}, added: [], deleted: [] })
    }
  })

  it('drops added notes missing a string id, title or body', () => {
    const parsed = parseStoredNotes({
      added: [
        { id: 'a', title: 'A', body: '', updated: '2026-10-29' },
        { id: 7, title: 'B', body: '' },
        { id: 'c', title: 'C' },
        'nope',
      ],
    })
    expect(parsed.added.map((n) => n.id)).toEqual(['a'])
  })

  it('keeps only well-formed edits and string deletions', () => {
    const good = { title: 'T', body: 'B', updated: '2026-10-29' }
    const parsed = parseStoredNotes({
      edits: { 'working-style': good, broken: { title: 1 } },
      deleted: ['looking-for', 3],
    })
    expect(parsed.edits).toEqual({ 'working-style': good })
    expect(parsed.deleted).toEqual(['looking-for'])
  })
})

describe('mergeNotes', () => {
  it('applies edits to seed notes and marks them local', () => {
    const stored = {
      ...emptyStoredNotes(),
      edits: { 'working-style': { title: 'Mine', body: '# Mine', updated: '2026-10-29' } },
    }
    const merged = mergeNotes(seed, stored)
    expect(merged.find((n) => n.id === 'working-style')).toMatchObject({
      title: 'Mine',
      body: '# Mine',
      updated: '2026-10-29',
      local: true,
    })
    expect(merged.find((n) => n.id === 'looking-for')).toMatchObject({
      title: seed[1].title,
      local: false,
    })
  })

  it('appends added notes and hides deleted ids', () => {
    const merged = mergeNotes(seed, {
      edits: {},
      added: [{ id: 'new', folder: 'Notes', title: 'New', body: '', updated: '2026-10-29' }],
      deleted: ['looking-for'],
    })
    expect(merged.map((n) => n.id)).toEqual(['new', 'working-style'])
  })

  it('ignores edits for unknown ids', () => {
    const merged = mergeNotes(seed, {
      edits: { ghost: { title: 'x', body: 'y', updated: '2026-10-29' } },
      added: [],
      deleted: [],
    })
    expect(merged.map((n) => n.id)).toEqual(seed.map((n) => n.id))
  })

  it('sorts by updated, newest first, with undated seed notes last in seed order', () => {
    const merged = mergeNotes(seed, {
      edits: { 'looking-for': { title: 'x', body: '', updated: '2026-01-02' } },
      added: [{ id: 'n', folder: 'Notes', title: 'N', body: '', updated: '2026-03-04' }],
      deleted: [],
    })
    expect(merged.map((n) => n.id)).toEqual(['n', 'looking-for', 'working-style'])
  })
})

describe('previewLine', () => {
  it('returns the first non-heading body line without list markers', () => {
    expect(previewLine('# Heading\n\n- First item\n- Second')).toBe('First item')
    expect(previewLine('# Only a heading')).toBe('')
  })
})

describe('localDay', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
