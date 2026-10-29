import type { Bookmark } from '../types'
import { links } from './links'
import { projects } from './projects'

const PROJECT_LINK_LABELS = { repo: 'Repository', demo: 'Demo', info: 'Info' } as const

const projectBookmarks: Bookmark[] = projects.flatMap((project) =>
  (Object.keys(PROJECT_LINK_LABELS) as (keyof typeof PROJECT_LINK_LABELS)[]).flatMap((kind) => {
    const url = project.links[kind]
    return url
      ? [{ id: `${project.id}-${kind}`, title: `${project.title} — ${PROJECT_LINK_LABELS[kind]}`, url, embeddable: false }]
      : []
  }),
)

// TODO(content): mark sites that allow framing as embeddable
export const bookmarks: Bookmark[] = [
  ...links.map((link) => ({ id: link.id, title: link.label, url: link.url, embeddable: false })),
  ...projectBookmarks,
]
