import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { APPS } from '../apps/registry'
import { buildIndex, rank, type SearchItem } from './search'

const index = buildIndex(getContent(), APPS)
const find = (title: string) => index.find((i) => i.title === title)

const item = (over: Partial<SearchItem> & Pick<SearchItem, 'title'>): SearchItem => ({
  id: over.title,
  subtitle: '',
  kind: 'document',
  command: { type: 'noop' },
  ...over,
})

describe('buildIndex', () => {
  it('indexes launchable apps with dock.activate', () => {
    expect(find('Mail')).toMatchObject({
      kind: 'app',
      command: { type: 'dock.activate', appId: 'mail' },
      appId: 'mail',
    })
    expect(index.some((i) => i.appId === 'quicklook')).toBe(false)
    expect(index.some((i) => i.appId === 'textedit')).toBe(false)
  })

  it('indexes Launchpad so it is searchable and opens via dock.activate', () => {
    expect(find('Launchpad')).toMatchObject({
      kind: 'app',
      appId: 'launchpad',
      command: { type: 'dock.activate', appId: 'launchpad' },
    })
  })

  it('indexes about documents, projects, experience, skills and folders with their open commands', () => {
    expect(find('Hello.md')).toMatchObject({
      kind: 'document',
      command: { type: 'app.open', appId: 'textedit', props: { fileId: 'doc-hello' } },
      nodeId: 'doc-hello',
    })

    for (const p of getContent().projects) {
      expect(find(p.title)).toMatchObject({
        kind: 'project',
        command: { type: 'app.open', appId: 'textedit', props: { fileId: `project-${p.id}` } },
        nodeId: `project-${p.id}`,
      })
    }

    for (const e of getContent().experience) {
      expect(find(`${e.role} — ${e.company}`)).toMatchObject({
        kind: 'experience',
        subtitle: e.company,
        command: { type: 'app.open', appId: 'textedit', props: { fileId: `work-${e.id}` } },
        nodeId: `work-${e.id}`,
      })
    }

    const skillsNamed = (name: string) => index.filter((i) => i.kind === 'skill' && i.title === name)
    const react = skillsNamed('React')
    expect(react).toHaveLength(1)
    expect(react[0]).toMatchObject({ subtitle: 'Frontend', nodeId: 'doc-skills' })

    for (const [title, folderId] of [
      ['About Me', 'about'],
      ['Work', 'work'],
      ['Projects', 'projects'],
      ['Documents', 'documents'],
    ] as const) {
      expect(find(title)).toMatchObject({
        kind: 'folder',
        command: { type: 'app.open', appId: 'finder', props: { folderId } },
        nodeId: folderId,
      })
    }
  })
})

describe('rank', () => {
  it('prefers title prefix, then word prefix, then substring, then subtitle', () => {
    const items = [
      item({ title: 'Zeta', subtitle: 'resume notes' }),
      item({ title: 'Big Rest' }),
      item({ title: 'Careful' }),
      item({ title: 'Resume' }),
    ]
    expect(rank(items, 're').map((i) => i.title)).toEqual(['Resume', 'Big Rest', 'Careful', 'Zeta'])
  })

  it('breaks ties by kind (app, document, project, experience, skill, folder) then title', () => {
    const items = [
      item({ title: 'Item Folder', kind: 'folder' }),
      item({ title: 'Item Skill', kind: 'skill' }),
      item({ title: 'Item Project', kind: 'project' }),
      item({ title: 'Item Doc', kind: 'document' }),
      item({ title: 'Item App B', kind: 'app' }),
      item({ title: 'Item Exp', kind: 'experience' }),
      item({ title: 'Item App A', kind: 'app' }),
    ]
    expect(rank(items, 'item').map((i) => i.title)).toEqual([
      'Item App A',
      'Item App B',
      'Item Doc',
      'Item Project',
      'Item Exp',
      'Item Skill',
      'Item Folder',
    ])
  })

  it('is case-insensitive, trims, and treats regex characters literally', () => {
    expect(rank(index, '  RESUME ').some((i) => i.title === 'Resume')).toBe(true)
    expect(() => rank(index, 'C++')).not.toThrow()
    expect(Array.isArray(rank(index, '('))).toBe(true)
    expect(rank([item({ title: 'Cafe', subtitle: 'Wrocław' })], 'wrocław')).toHaveLength(1)
  })

  it('returns [] for an empty query and caps at limit', () => {
    expect(rank(index, '   ')).toEqual([])
    expect(rank(index, 'e')).toHaveLength(8)
    expect(rank(index, 'e', 3)).toHaveLength(3)
  })
})
