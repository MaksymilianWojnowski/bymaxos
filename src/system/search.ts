import type { AppDefinition } from '../apps/types'
import type { Content } from '../content/types'
import type { Command } from './commands'
import type { AppId } from './types'

export type SearchKind = 'app' | 'document' | 'project' | 'experience' | 'skill' | 'folder'

export interface SearchItem {
  id: string
  title: string
  subtitle: string
  kind: SearchKind
  command: Command
  appId?: AppId
  nodeId?: string
}

// Ties in score are broken by this order, then by title.
const KIND_ORDER: SearchKind[] = ['app', 'document', 'project', 'experience', 'skill', 'folder']
const FOLDERS: [folderId: string, name: string][] = [
  ['about', 'About Me'],
  ['work', 'Work'],
  ['projects', 'Projects'],
  ['documents', 'Documents'],
]
const WORD_SPLIT = /[^\p{L}\p{N}]+/u

const openInTextEdit = (fileId: string): Command => ({
  type: 'app.open',
  appId: 'textedit',
  props: { fileId },
})

export function buildIndex(content: Content, apps: AppDefinition[]): SearchItem[] {
  const items: SearchItem[] = []

  // Apps that need a file to show (deepLink: false) are left out; the rest open through the Dock's dock.activate.
  for (const app of apps) {
    if (!((app.load && app.deepLink !== false) || app.external || app.alias)) continue
    items.push({
      id: `app:${app.id}`,
      title: app.name,
      subtitle: '',
      kind: 'app',
      appId: app.id,
      command: { type: 'dock.activate', appId: app.id },
    })
  }

  for (const d of content.documents) {
    if (d.folder !== 'about') continue
    items.push({
      id: `document:${d.id}`,
      title: d.name,
      subtitle: 'About Me',
      kind: 'document',
      nodeId: `doc-${d.id}`,
      command: openInTextEdit(`doc-${d.id}`),
    })
  }

  for (const p of content.projects) {
    items.push({
      id: `project:${p.id}`,
      title: p.title,
      subtitle: p.summary,
      kind: 'project',
      nodeId: `project-${p.id}`,
      command: openInTextEdit(`project-${p.id}`),
    })
  }

  for (const e of content.experience) {
    items.push({
      id: `experience:${e.id}`,
      title: `${e.role} — ${e.company}`,
      subtitle: e.company,
      kind: 'experience',
      nodeId: `work-${e.id}`,
      command: openInTextEdit(`work-${e.id}`),
    })
  }

  // A skill listed in two groups is one result, shown under its first group.
  const seen = new Set<string>()
  for (const group of content.skills) {
    for (const name of group.items) {
      if (seen.has(name)) continue
      seen.add(name)
      items.push({
        id: `skill:${name}`,
        title: name,
        subtitle: group.label,
        kind: 'skill',
        nodeId: 'doc-skills',
        command: openInTextEdit('doc-skills'),
      })
    }
  }

  for (const [folderId, name] of FOLDERS) {
    items.push({
      id: `folder:${folderId}`,
      title: name,
      subtitle: '',
      kind: 'folder',
      nodeId: folderId,
      command: { type: 'app.open', appId: 'finder', props: { folderId } },
    })
  }

  return items
}

// Scores: 0 title starts with the query, 1 a title word does, 2 title contains it, 3 subtitle contains it.
export function rank(items: SearchItem[], query: string, limit = 8): SearchItem[] {
  const q = query.trim().toLocaleLowerCase('en')
  if (q === '') return []

  const scored: { item: SearchItem; score: number; title: string }[] = []
  for (const item of items) {
    const title = item.title.toLocaleLowerCase('en')
    let score: number
    if (title.startsWith(q)) score = 0
    else if (title.split(WORD_SPLIT).some((w) => w.startsWith(q))) score = 1
    else if (title.includes(q)) score = 2
    else if (item.subtitle.toLocaleLowerCase('en').includes(q)) score = 3
    else continue
    scored.push({ item, score, title })
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_ORDER.indexOf(a.item.kind) - KIND_ORDER.indexOf(b.item.kind) ||
      a.title.localeCompare(b.title, 'en'),
  )
  return scored.slice(0, limit).map((s) => s.item)
}
