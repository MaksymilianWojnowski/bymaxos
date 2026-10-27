import { describe, expect, it } from 'vitest'
import { parseDeepLink, selectShell } from './shell'

describe('selectShell', () => {
  it('chooses mobile for narrow viewports and for coarse short viewports', () => {
    expect(selectShell({ width: 390, height: 844, coarse: true })).toBe('mobile')
    expect(selectShell({ width: 844, height: 390, coarse: true })).toBe('mobile')
    expect(selectShell({ width: 700, height: 900, coarse: false })).toBe('mobile')
  })

  it('chooses desktop otherwise', () => {
    expect(selectShell({ width: 1024, height: 768, coarse: true })).toBe('desktop')
    expect(selectShell({ width: 800, height: 600, coarse: false })).toBe('desktop')
  })
})

describe('parseDeepLink', () => {
  it('accepts registered apps that open a window', () => {
    expect(parseDeepLink('?app=finder')).toEqual({ appId: 'finder' })
    expect(parseDeepLink('?app=finder&item=projects')).toEqual({ appId: 'finder', item: 'projects' })
  })

  it('rejects external, alias, unknown and malformed ids', () => {
    expect(parseDeepLink('?app=linkedin')).toBeNull()
    expect(parseDeepLink('?app=trash')).toBeNull()
    expect(parseDeepLink('?app=<script>')).toBeNull()
    expect(parseDeepLink('?app=nope')).toBeNull()
    // Quick Look needs a file to preview, so a bare link would open an empty window.
    expect(parseDeepLink('?app=quicklook')).toBeNull()
    expect(parseDeepLink('')).toBeNull()
  })

  it('drops a malformed item but keeps the app', () => {
    expect(parseDeepLink('?app=finder&item=<b>')).toEqual({ appId: 'finder' })
  })
})
