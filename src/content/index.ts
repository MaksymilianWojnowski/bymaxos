import { documents } from './en/documents'
import { education } from './en/education'
import { experience } from './en/experience'
import { links } from './en/links'
import { profile } from './en/profile'
import { projects } from './en/projects'
import { site } from './en/site'
import { languages, skills, softSkills } from './en/skills'
import type { Content, Locale } from './types'

const en: Content = {
  profile,
  links,
  experience,
  education,
  skills,
  softSkills,
  languages,
  projects,
  documents,
  site,
}

const contents: Record<Locale, Content> = { en }

export function getContent(locale: Locale = 'en'): Content {
  return contents[locale]
}
