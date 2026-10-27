import type { AppId, WMState } from './types'

// Each app once, ordered by its highest window z so the most recently used comes first; minimized windows count.
// The focused app always leads: focus can move to a lower-z window after a minimize without raising it.
export function runningAppsByRecency(wm: WMState): AppId[] {
  const topZ = new Map<AppId, number>()
  for (const w of wm.windows) topZ.set(w.appId, Math.max(topZ.get(w.appId) ?? 0, w.z))
  const focused = wm.windows.find((w) => w.id === wm.focusedId)
  if (focused) topZ.set(focused.appId, Infinity)
  return [...topZ.keys()].sort((a, b) => (topZ.get(b) ?? 0) - (topZ.get(a) ?? 0))
}
