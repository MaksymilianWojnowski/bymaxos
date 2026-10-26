import type { Language, SkillGroup } from '../types'

export const skills: SkillGroup[] = [
  {
    id: 'pm',
    label: 'PM / Scrum Master',
    items: [
      'Agile ceremonies (daily syncs, sprint planning, retrospectives)',
      'requirements clarification',
      'stakeholder communication',
      'conflict resolution',
      'documentation & action tracking',
    ],
  },
  {
    id: 'data',
    label: 'BI / Data',
    items: ['SQL (MySQL/PostgreSQL)', 'Power BI', 'Tableau', 'Excel', 'basic data modelling for analysis'],
  },
  {
    id: 'frontend',
    label: 'Frontend',
    items: ['React', 'Next.js', 'TypeScript/JavaScript (ES6+)', 'HTML', 'CSS', 'Tailwind CSS', 'PrimeReact'],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: ['Git', 'GitLab (issues/MRs/CI)', 'Python (Pandas, NumPy, Matplotlib)'],
  },
]

export const softSkills: string[] = [
  'People reading & adaptive communication',
  'Conflict prevention & mediation',
  'Team facilitation & relationship building',
  'Project planning & coordination',
  'Public speaking & presentation',
  'Creative problem-solving & adaptability',
]

export const languages: Language[] = [
  { name: 'Polish', level: 'native' },
  { name: 'English', level: 'fluent (C1/C2)' },
  { name: 'Portuguese', level: 'basic (A2)' },
]
