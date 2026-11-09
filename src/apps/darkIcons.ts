import type { AppDefinition } from './types'

// Apple's dark app icons, exported by scripts/export-apple-icons.swift --dark, keyed by file name.
const files = import.meta.glob<string>('../assets/icons/dark/*.png', { eager: true, import: 'default' })

export const darkIcons: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.png$/, ''), url]),
)

// All or nothing: a home screen that mixes dark and light Apple icons reads as a defect.
// Hidden apps never render on the phone, so they cannot break the set.
export function darkIconsComplete(apps: AppDefinition[]): boolean {
  return apps.every((a) => {
    if (!('image' in a.icon) || a.mobile?.presentation === 'hidden') return true
    const key = a.icon.darkKey
    return key !== undefined && key in darkIcons
  })
}
