import { useSyncExternalStore } from 'react'
import { getApp } from '../apps/registry'
import type { AppId } from './types'

export type Shell = 'desktop' | 'mobile'

// Single rule shared by the pure function and the live hook.
const pickShell = (narrow: boolean, coarse: boolean, short: boolean): Shell =>
  narrow || (coarse && short) ? 'mobile' : 'desktop'

export function selectShell(v: { width: number; height: number; coarse: boolean }): Shell {
  return pickShell(v.width < 768, v.coarse, v.height <= 500)
}

const NARROW = '(max-width: 767px)'
const COARSE = '(pointer: coarse)'
const SHORT = '(max-height: 500px)'
const QUERIES = [NARROW, COARSE, SHORT]

const readShell = (): Shell =>
  pickShell(
    window.matchMedia(NARROW).matches,
    window.matchMedia(COARSE).matches,
    window.matchMedia(SHORT).matches,
  )

function subscribe(onChange: () => void): () => void {
  const lists = QUERIES.map((q) => window.matchMedia(q))
  for (const list of lists) list.addEventListener('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

export function useShell(): Shell {
  return useSyncExternalStore(subscribe, readShell)
}

const SAFE_ID = /^[a-z0-9-]+$/

// Deep links open only apps that have a window, so external links and aliases never match.
export function parseDeepLink(search: string): { appId: AppId; item?: string } | null {
  const params = new URLSearchParams(search)
  const appId = params.get('app')
  if (appId === null || !SAFE_ID.test(appId)) return null
  const app = getApp(appId)
  if (!app?.load || app.deepLink === false) return null
  const item = params.get('item')
  return item !== null && SAFE_ID.test(item) ? { appId, item } : { appId }
}
