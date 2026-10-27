import { describe, expect, it } from 'vitest'
import type { VNode } from '../../system/vfs'
import { back, forward, initFinder, navigate, openTarget } from './finderState'
import { vfs } from './vfsInstance'

describe('finder history', () => {
  it('goes back and forward between folders', () => {
    const s = navigate(initFinder(), 'projects')
    const b = back(s)
    expect(b.history[b.index]).toBe('desktop')
    const f = forward(b)
    expect(f.history[f.index]).toBe('projects')
  })

  it('drops forward history when navigating after going back', () => {
    const s = back(navigate(initFinder(), 'projects'))
    const next = navigate(s, 'work')
    expect(next.history).toEqual(['desktop', 'work'])
    expect(forward(next)).toBe(next)
  })

  it('returns the same state when navigating to the current folder', () => {
    const s = initFinder()
    expect(navigate(s, 'desktop')).toBe(s)
    const deeper = navigate(s, 'projects')
    expect(navigate(deeper, 'projects')).toBe(deeper)
  })

  it('treats back at the first folder as a no-op', () => {
    const s = initFinder()
    expect(back(s)).toBe(s)
  })
})

describe('openTarget', () => {
  it('navigates into a folder', () => {
    expect(openTarget(vfs.nodes.projects)).toEqual({ type: 'finder.navigate', folderId: 'projects' })
  })

  it('opens a Markdown document in TextEdit', () => {
    expect(openTarget(vfs.nodes['doc-hello'])).toEqual({
      type: 'app.open',
      appId: 'textedit',
      props: { fileId: 'doc-hello' },
    })
  })

  it('opens Resume.pdf in the Resume app', () => {
    expect(openTarget(vfs.nodes['resume-pdf'])).toEqual({
      type: 'app.open',
      appId: 'resume',
      props: undefined,
    })
  })

  it('opens a file in Quick Look when its app is not registered', () => {
    const node = { ...vfs.nodes['resume-pdf'], open: { appId: 'safari' } } as VNode
    expect(openTarget(node)).toEqual({
      type: 'app.open',
      appId: 'quicklook',
      props: { nodeId: 'resume-pdf' },
    })
  })
})
