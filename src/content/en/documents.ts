import type { DocumentFile } from '../types'
import { profile } from './profile'
import { languages, skills } from './skills'

const skillsBody = skills
  .map((group) => `# ${group.label}\n\n${group.items.map((item) => `- ${item}`).join('\n')}`)
  .join('\n\n')

const languagesBody = `# Languages\n\n${languages.map((l) => `- ${l.name} — ${l.level}`).join('\n')}`

export const documents: DocumentFile[] = [
  {
    id: 'hello',
    folder: 'about',
    name: 'Hello.md',
    body: `# ${profile.headline}\n\n${profile.summary}`,
  },
  {
    id: 'skills',
    folder: 'about',
    name: 'Skills.md',
    body: skillsBody,
  },
  {
    id: 'languages',
    folder: 'about',
    name: 'Languages.md',
    body: languagesBody,
  },
  // TODO(content): interests notes (folder 'interests' is empty for now)
]
