export interface Profile {
  name: string
  headline: string
  location: string
  email: string
  avatarUrl?: string
  summary: string
  lookingFor: string
}

export interface Link {
  id: 'linkedin' | 'github' | string
  label: string
  url: string
  kind: 'social' | 'code' | 'other'
}

export interface Experience {
  id: string
  company: string
  role: string
  start: string /* 'YYYY-MM' */
  end?: string
  location: string
  highlights: { title: string; text: string }[]
}

export interface Education {
  id: string
  school: string
  degree?: string
  start: string
  end?: string
  location: string
  notes: string[]
  grade?: string
}

export interface SkillGroup {
  id: string
  label: string
  items: string[]
}

export interface Language {
  name: string
  level: string
}

export interface Project {
  id: string
  title: string
  summary: string
  bullets: string[]
  tech: string[]
  links: { repo?: string; demo?: string; info?: string }
}

export interface DocumentFile {
  id: string
  folder: 'about' | 'interests'
  name: string /* e.g. 'Hello.md' */
  body: string /* light markdown: '# ', '- ', blank-line paragraphs */
}

export interface Wallpaper {
  id: string
  name: string
  src?: string
  gradient: string
}

export interface MeetingType {
  id: string
  title: string
  minutes: number
  description: string
  slug: string /* Cal.com event slug */
}

export interface Site {
  repoUrl?: string
  wallpapers: Wallpaper[]
  resume: { pdfUrl?: string }
  scheduling: { calUrl?: string; meetingTypes: MeetingType[] }
}

export interface Note {
  id: string
  folder: string
  title: string
  body: string /* light markdown, same subset as DocumentFile */
  updated?: string /* YYYY-MM-DD */
}

export interface MusicArtist {
  id: string
  name: string
  url?: string
}

export interface MusicAlbum {
  id: string
  title: string
  artist: string
  year?: number
  url?: string
}

export interface MusicPlaylist {
  id: string
  title: string
  description?: string
  spotifyId?: string
  spotifyUrl?: string
  appleMusicUrl?: string
}

export interface Place {
  id: string
  name: string
  country: string
  lat: number
  lon: number
  from?: string /* 'YYYY-MM' */
  to?: string /* 'YYYY-MM' */
  note: string
}

export interface Photo {
  id: string
  src: string
  alt: string
  width: number
  height: number
  caption?: string
}

export interface PhotoAlbum {
  id: string
  title: string
  photos: Photo[]
}

export interface Bookmark {
  id: string
  title: string
  url: string
  embeddable: boolean
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  appId?: string
}

export interface Content {
  profile: Profile
  notifications: NotificationItem[]
  links: Link[]
  experience: Experience[]
  education: Education[]
  skills: SkillGroup[]
  softSkills: string[]
  languages: Language[]
  projects: Project[]
  documents: DocumentFile[]
  notes: Note[]
  music: { artists: MusicArtist[]; albums: MusicAlbum[]; playlists: MusicPlaylist[] }
  places: Place[]
  photoAlbums: PhotoAlbum[]
  bookmarks: Bookmark[]
  site: Site
}

export type Locale = 'en'
