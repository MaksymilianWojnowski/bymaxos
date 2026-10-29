import { describe, it, expect } from 'vitest'
import { getApp } from '../apps/registry'
import { getContent } from './index'

const content = getContent()

const ids = (items: { id: string }[]) => items.map((i) => i.id)

describe('content', () => {
  it('uses only https URLs', () => {
    const urls = [
      ...content.links.map((l) => l.url),
      ...content.projects.flatMap((p) => Object.values(p.links)),
      content.site.repoUrl,
      content.site.resume.pdfUrl,
      content.site.scheduling.calUrl,
    ].filter((u): u is string => typeof u === 'string')

    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) expect(url).toMatch(/^https:\/\//)
  })

  it('has the public email and no phone number anywhere', () => {
    expect(content.profile.email).toBe('maksymilianwojnowski@gmail.com')
    expect(JSON.stringify(content)).not.toMatch(/\+48|535\s?982/)
  })

  it('has unique ids within each collection', () => {
    for (const list of [
      content.links,
      content.experience,
      content.education,
      content.skills,
      content.projects,
      content.documents,
      content.site.wallpapers,
    ]) {
      const listIds = ids(list)
      expect(new Set(listIds).size).toBe(listIds.length)
    }
  })

  it('has non-empty profile text', () => {
    expect(content.profile.name.trim()).not.toBe('')
    expect(content.profile.headline.trim()).not.toBe('')
    expect(content.profile.summary.trim()).not.toBe('')
  })

  it('uses YYYY-MM for experience start dates', () => {
    for (const job of content.experience) expect(job.start).toMatch(/^\d{4}-\d{2}$/)
  })

  it('includes a default wallpaper', () => {
    expect(ids(content.site.wallpapers)).toContain('default')
  })

  it('notification ids are unique, titles and bodies non-empty, appIds exist in the registry', () => {
    const list = content.notifications
    expect(new Set(ids(list)).size).toBe(list.length)
    for (const n of list) {
      expect(n.title.trim()).not.toBe('')
      expect(n.body.trim()).not.toBe('')
      if (n.appId !== undefined) expect(getApp(n.appId)).toBeDefined()
    }
  })

  it('meeting type ids are unique and slugs non-empty', () => {
    const types = content.site.scheduling.meetingTypes
    expect(new Set(ids(types)).size).toBe(types.length)
    for (const t of types) expect(t.slug.trim()).not.toBe('')
  })

  it('ids are unique within notes, places, bookmarks, albums and photos (across albums)', () => {
    const photoIds = content.photoAlbums.flatMap((a) => a.photos.map((p) => p.id))
    const lists = [
      content.notes,
      content.places,
      content.bookmarks,
      content.photoAlbums,
      content.music.artists,
      content.music.albums,
      content.music.playlists,
    ]
    for (const list of lists) expect(new Set(ids(list)).size).toBe(list.length)
    expect(new Set(photoIds).size).toBe(photoIds.length)
  })

  it('bookmarks and music URLs are https; spotifyId matches /^[A-Za-z0-9]{22}$/ when set', () => {
    const urls = [
      ...content.bookmarks.map((b) => b.url),
      ...content.music.artists.map((a) => a.url),
      ...content.music.albums.map((a) => a.url),
      ...content.music.playlists.flatMap((p) => [p.spotifyUrl, p.appleMusicUrl]),
    ].filter((u): u is string => typeof u === 'string')
    for (const url of urls) expect(url).toMatch(/^https:\/\//)
    for (const p of content.music.playlists) {
      if (p.spotifyId !== undefined) expect(p.spotifyId).toMatch(/^[A-Za-z0-9]{22}$/)
    }
  })

  it('places have lat in [-90, 90] and lon in [-180, 180]; from/to match YYYY-MM when set', () => {
    for (const place of content.places) {
      expect(place.lat).toBeGreaterThanOrEqual(-90)
      expect(place.lat).toBeLessThanOrEqual(90)
      expect(place.lon).toBeGreaterThanOrEqual(-180)
      expect(place.lon).toBeLessThanOrEqual(180)
      for (const date of [place.from, place.to]) {
        if (date !== undefined) expect(date).toMatch(/^\d{4}-\d{2}$/)
      }
    }
  })

  it('photos have non-empty alt and positive width/height', () => {
    for (const photo of content.photoAlbums.flatMap((a) => a.photos)) {
      expect(photo.alt.trim()).not.toBe('')
      expect(photo.width).toBeGreaterThan(0)
      expect(photo.height).toBeGreaterThan(0)
    }
  })

  it('seed: notes has the two CV-derived notes, places has Wrocław and Tokyo, music and photoAlbums are empty', () => {
    expect(ids(content.notes)).toEqual(['working-style', 'looking-for'])
    expect(ids(content.places)).toEqual(['wroclaw', 'tokyo'])
    expect(content.music).toEqual({ artists: [], albums: [], playlists: [] })
    expect(content.photoAlbums).toEqual([])
  })
})
