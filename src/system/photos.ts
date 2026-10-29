import type { Photo, PhotoAlbum } from '../content/types'

// Relative photo paths resolve against the deployed base path, as the Resume PDF does.
export const photoUrl = (src: string): string =>
  /^https?:\/\//.test(src) ? src : `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`

// A photo can sit in several albums; each one appears once.
export const allPhotos = (albums: PhotoAlbum[]): Photo[] =>
  [...new Map(albums.flatMap((a) => a.photos).map((p) => [p.id, p])).values()]
