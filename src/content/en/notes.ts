import type { Note } from '../types'
import { profile } from './profile'
import { softSkills } from './skills'

// TODO(content): add personal notes
export const notes: Note[] = [
  {
    id: 'working-style',
    folder: 'Notes',
    title: 'Working style',
    body: `# Working style\n\n${softSkills.map((skill) => `- ${skill}`).join('\n')}`,
  },
  {
    id: 'looking-for',
    folder: 'Notes',
    title: "What I'm looking for",
    body: `# What I'm looking for\n\n${profile.lookingFor}`,
  },
]
