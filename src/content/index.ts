import { documents } from './en/documents'
import { education } from './en/education'
import { experience } from './en/experience'
import { links } from './en/links'
import { bookmarks } from './en/bookmarks'
import { music } from './en/music'
import { notes } from './en/notes'
import { notifications } from './en/notifications'
import { photoAlbums } from './en/photos'
import { places } from './en/places'
import { profile } from './en/profile'
import { projects } from './en/projects'
import { site } from './en/site'
import { languages, skills, softSkills } from './en/skills'
import type { Content, Locale } from './types'

const en: Content = {
  profile,
  notifications,
  links,
  experience,
  education,
  skills,
  softSkills,
  languages,
  projects,
  documents,
  notes,
  music,
  places,
  photoAlbums,
  bookmarks,
  site,
}

const contents: Record<Locale, Content> = { en }

export function getContent(locale: Locale = 'en'): Content {
  return contents[locale]
}
