import { describe, expect, it } from 'vitest'
import type { AppDefinition } from './types'
import { darkIconsComplete } from './darkIcons'

// 'notes' has a real dark file in src/assets/icons/dark; 'missing' does not.
const app = (id: string, icon: AppDefinition['icon'], mobile?: AppDefinition['mobile']) =>
  ({ id, name: id, icon, mobile }) as AppDefinition

describe('darkIconsComplete', () => {
  it('a visible image app with a dark file keeps the set complete', () => {
    expect(darkIconsComplete([app('notes', { image: 'x', darkKey: 'notes' })])).toBe(true)
  })

  it('a visible image app without a dark file makes the set incomplete', () => {
    expect(darkIconsComplete([app('notes', { image: 'x', darkKey: 'missing' })])).toBe(false)
  })

  it('a hidden image app without a dark file does not make the set incomplete', () => {
    const hidden = app('trash', { image: 'x' }, { presentation: 'hidden' })
    expect(darkIconsComplete([hidden])).toBe(true)
  })

  it('a visible image app without a darkKey makes the set incomplete', () => {
    expect(darkIconsComplete([app('trash', { image: 'x' })])).toBe(false)
  })
})
