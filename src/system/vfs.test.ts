import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { buildVfs, pathTo } from './vfs'
import type { VNode } from './vfs'

const vfs = buildVfs(getContent())

const folder = (id: string) => {
  const node = vfs.nodes[id]
  if (node?.kind !== 'folder') throw new Error(`${id} is not a folder`)
  return node
}

describe('buildVfs', () => {
  it('lists the desktop children in order', () => {
    expect(vfs.nodes.desktop).toMatchObject({ kind: 'folder', name: 'Desktop' })
    expect(folder('desktop').children).toEqual(['resume-pdf', 'about', 'projects', 'contact-vcf'])
    expect(vfs.desktop).toEqual(['resume-pdf', 'about', 'projects', 'contact-vcf'])
  })

  it('exposes the sidebar entries', () => {
    expect(vfs.sidebar).toEqual([
      'desktop',
      'documents',
      'about',
      'work',
      'projects',
      'photos',
      'interests',
      'trash',
    ])
  })

  it('resolves every child id to a node', () => {
    for (const node of Object.values(vfs.nodes)) {
      if (node.kind !== 'folder') continue
      for (const child of node.children) expect(vfs.nodes[child], child).toBeDefined()
    }
  })

  it('creates one work file per experience with the given name', () => {
    expect(folder('work').children).toHaveLength(2)
    const nokia = vfs.nodes['work-nokia']
    expect(nokia).toMatchObject({ kind: 'file', name: 'Nokia — Lead Frontend Developer.md', fileType: 'md' })
  })

  it('gives LigaPWr a webloc pointing at its repo', () => {
    const webloc = vfs.nodes['project-ligapwr-repo']
    expect(webloc).toMatchObject({
      kind: 'file',
      name: 'LigaPWr Web App (repo).webloc',
      fileType: 'webloc',
      open: { appId: 'safari', props: { url: 'https://github.com/informatyzacja/LigaPWr' } },
      preview: {
        kind: 'link',
        title: 'LigaPWr Web App (repo)',
        url: 'https://github.com/informatyzacja/LigaPWr',
        description: 'Team of 5',
      },
    })
  })

  it('puts the resume and contact card on the documents folder with the right apps', () => {
    expect(folder('documents').children).toEqual(['resume-pdf', 'contact-vcf'])
    expect(vfs.nodes['resume-pdf']).toMatchObject({ kind: 'file', fileType: 'pdf', open: { appId: 'resume' } })
    expect(vfs.nodes['contact-vcf']).toMatchObject({ kind: 'file', fileType: 'vcf', open: { appId: 'contacts' } })
  })

  it('never renders a phone number', () => {
    expect(JSON.stringify(vfs)).not.toContain('+48')
  })

  it('puts about documents in About Me with a textedit docId', () => {
    expect(folder('about').children).toContain('doc-hello')
    expect(vfs.nodes['doc-hello']).toMatchObject({
      kind: 'file',
      name: 'Hello.md',
      open: { appId: 'textedit', props: { docId: 'hello' } },
    })
  })

  it('shows the interests placeholder only when there are no interest documents', () => {
    expect(folder('interests')).toMatchObject({ children: [], placeholder: 'Interests are coming soon.' })
    expect(folder('photos')).toMatchObject({ children: [], placeholder: "Photos will appear here once they're added." })
    expect(folder('trash')).toMatchObject({ children: [], placeholder: 'Trash is empty.' })
  })

  it('does not mutate the content object', () => {
    const content = getContent()
    const snapshot = JSON.stringify(content)
    buildVfs(content)
    expect(JSON.stringify(content)).toBe(snapshot)
  })
})

describe('node ids', () => {
  it('are unique, so a duplicate id is an error rather than a silent overwrite', () => {
    const ids = Object.values(vfs.nodes).map((n) => n.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(vfs.nodes)).toEqual(ids)

    const content = structuredClone(getContent())
    content.documents.push({ ...content.documents[0] })
    expect(() => buildVfs(content)).toThrow(/duplicate vfs node id: doc-hello/)
  })
})

describe('pathTo', () => {
  it('returns ancestor ids from root to the node', () => {
    expect(pathTo(vfs, 'doc-hello')).toEqual(['root', 'about', 'doc-hello'])
  })

  it('prefers the non-desktop parent for aliases', () => {
    expect(pathTo(vfs, 'resume-pdf')).toEqual(['root', 'documents', 'resume-pdf'])
    expect(pathTo(vfs, 'about')).toEqual(['root', 'about'])
  })

  it('returns [] for unknown ids', () => {
    expect(pathTo(vfs, 'nope')).toEqual([])
  })

  it('returns the root path for root', () => {
    expect(pathTo(vfs, 'root')).toEqual(['root'])
  })
})

describe('node shape', () => {
  it('gives every node a name', () => {
    const nodes: VNode[] = Object.values(vfs.nodes)
    for (const node of nodes) expect(node.name.length).toBeGreaterThan(0)
  })
})
