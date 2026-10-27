import { describe, it, expect } from 'vitest'
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

  it('meeting type ids are unique and slugs non-empty', () => {
    const types = content.site.scheduling.meetingTypes
    expect(new Set(ids(types)).size).toBe(types.length)
    for (const t of types) expect(t.slug.trim()).not.toBe('')
  })
})
