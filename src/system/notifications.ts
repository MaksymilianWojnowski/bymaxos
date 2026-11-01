import { KEYS, safeStorage } from './storage'

// Session storage is untrusted input: anything but a list of ids is treated as nothing dismissed.
export function readDismissed(): string[] {
  const value = safeStorage.get<unknown>('session', KEYS.notifications, [])
  return Array.isArray(value) && value.every((id) => typeof id === 'string') ? value : []
}

export function saveDismissed(ids: string[]): void {
  safeStorage.set('session', KEYS.notifications, ids)
}
