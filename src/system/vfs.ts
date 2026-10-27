import type { Content, DocumentFile, Experience, Project } from '../content/types'
import type { AppId } from './types'

export type FileType = 'md' | 'pdf' | 'vcf' | 'webloc'
export type Preview =
  | { kind: 'text'; title: string; body: string }
  | { kind: 'link'; title: string; url: string; description: string }

export type VNode =
  | { id: string; name: string; kind: 'folder'; children: string[]; placeholder?: string }
  | {
      id: string
      name: string
      kind: 'file'
      fileType: FileType
      open: { appId: AppId; props?: Record<string, unknown> }
      preview: Preview
    }

export interface Vfs {
  nodes: Record<string, VNode>
  sidebar: string[]
  desktop: string[]
}

const folder = (id: string, name: string, children: string[] = [], placeholder?: string): VNode => ({
  id,
  name,
  kind: 'folder',
  children,
  ...(placeholder ? { placeholder } : {}),
})

const file = (
  id: string,
  name: string,
  fileType: FileType,
  open: { appId: AppId; props?: Record<string, unknown> },
  preview: Preview,
): VNode => ({ id, name, kind: 'file', fileType, open, preview })

const textPreview = (title: string, body: string): Preview => ({ kind: 'text', title, body })

const workFile = (e: Experience): VNode =>
  file(
    `work-${e.id}`,
    `${e.company} — ${e.role}.md`,
    'md',
    { appId: 'textedit', props: { fileId: `work-${e.id}` } },
    textPreview(
      `${e.company} — ${e.role}.md`,
      `# ${e.role} — ${e.company}\n\n${e.start} – ${e.end ?? 'Present'} · ${e.location}\n\n` +
        e.highlights.map((h) => `- ${h.title}: ${h.text}`).join('\n'),
    ),
  )

const projectFiles = (p: Project): VNode[] => {
  const md = file(
    `project-${p.id}`,
    `${p.title}.md`,
    'md',
    { appId: 'textedit', props: { fileId: `project-${p.id}` } },
    textPreview(
      `${p.title}.md`,
      `# ${p.title}\n\n${p.summary}\n\n` +
        p.bullets.map((b) => `- ${b}`).join('\n') +
        (p.tech.length > 0 ? `\n\nTech: ${p.tech.join(', ')}` : ''),
    ),
  )
  const weblocs = (['repo', 'demo', 'info'] as const).flatMap((kind) => {
    const url = p.links[kind]
    if (!url) return []
    const title = `${p.title} (${kind})`
    return [
      file(
        `project-${p.id}-${kind}`,
        `${title}.webloc`,
        'webloc',
        { appId: 'safari', props: { url } },
        { kind: 'link', title, url, description: p.summary },
      ),
    ]
  })
  return [md, ...weblocs]
}

const docFile = (d: DocumentFile): VNode =>
  file(`doc-${d.id}`, d.name, 'md', { appId: 'textedit', props: { fileId: `doc-${d.id}` } }, textPreview(d.name, d.body))

// Desktop children are aliases of nodes that live in their real folders.
const DESKTOP_CHILDREN = ['resume-pdf', 'about', 'projects', 'contact-vcf']

export function buildVfs(c: Content): Vfs {
  const interests = c.documents.filter((d) => d.folder === 'interests')
  const { profile } = c
  const projectNodes = c.projects.flatMap(projectFiles)

  const nodeList: VNode[] = [
    folder('root', 'bymaxOS', ['desktop', 'documents', 'about', 'work', 'projects', 'photos', 'interests', 'trash']),
    folder('desktop', 'Desktop', DESKTOP_CHILDREN),
    folder('documents', 'Documents', ['resume-pdf', 'contact-vcf']),
    file(
      'resume-pdf',
      'Resume.pdf',
      'pdf',
      { appId: 'resume' },
      textPreview(
        'Resume.pdf',
        `# ${profile.name}\n\n${profile.headline}\n\n${profile.summary}`,
      ),
    ),
    file(
      'contact-vcf',
      'Contact.vcf',
      'vcf',
      { appId: 'contacts' },
      textPreview('Contact.vcf', `# ${profile.name}\n\n${profile.email}\n${profile.location}`),
    ),
    folder(
      'about',
      'About Me',
      c.documents.filter((d) => d.folder === 'about').map((d) => `doc-${d.id}`),
    ),
    folder(
      'work',
      'Work',
      c.experience.map((e) => `work-${e.id}`),
    ),
    folder(
      'projects',
      'Projects',
      projectNodes.map((n) => n.id),
    ),
    folder('photos', 'Photos', [], "Photos will appear here once they're added."),
    folder(
      'interests',
      'Interests',
      interests.map((d) => `doc-${d.id}`),
      interests.length === 0 ? 'Interests are coming soon.' : undefined,
    ),
    folder('trash', 'Trash', [], 'Trash is empty.'),
    ...c.documents.filter((d) => d.folder === 'about' || d.folder === 'interests').map(docFile),
    ...c.experience.map(workFile),
    ...projectNodes,
  ]

  const nodes: Record<string, VNode> = {}
  for (const n of nodeList) {
    // Object.fromEntries would keep the last of two nodes with the same id without a word.
    if (Object.hasOwn(nodes, n.id)) throw new Error(`duplicate vfs node id: ${n.id}`)
    nodes[n.id] = n
  }
  return {
    nodes,
    sidebar: ['desktop', 'documents', 'about', 'work', 'projects', 'photos', 'interests', 'trash'],
    desktop: DESKTOP_CHILDREN,
  }
}

export function pathTo(vfs: Vfs, id: string): string[] {
  if (!vfs.nodes[id]) return []
  const parents = new Map<string, string>()
  const seen = new Set<string>()
  const stack = ['root']
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (seen.has(current)) continue
    seen.add(current)
    const node = vfs.nodes[current]
    if (node?.kind !== 'folder') continue
    for (const child of node.children) {
      const existing = parents.get(child)
      if (existing === undefined || (existing === 'desktop' && current !== 'desktop')) parents.set(child, current)
      stack.push(child)
    }
  }
  const path = [id]
  let cursor = id
  while (parents.has(cursor)) {
    cursor = parents.get(cursor) as string
    path.unshift(cursor)
  }
  return path[0] === 'root' ? path : []
}
