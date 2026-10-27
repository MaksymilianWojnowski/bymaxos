import { getApp } from '../registry'
import type { Command } from '../../system/commands'
import type { VNode } from '../../system/vfs'

export type FinderView = 'icons' | 'list'

export interface FinderState {
  history: string[]
  index: number
  view: FinderView
  selected: string | null
}

export function initFinder(folderId = 'desktop'): FinderState {
  return { history: [folderId], index: 0, view: 'icons', selected: null }
}

// Navigating drops any forward history, as in a browser; re-entering the current folder changes nothing.
export function navigate(s: FinderState, folderId: string): FinderState {
  if (s.history[s.index] === folderId) return s
  return {
    ...s,
    history: [...s.history.slice(0, s.index + 1), folderId],
    index: s.index + 1,
    selected: null,
  }
}

export function back(s: FinderState): FinderState {
  return s.index > 0 ? { ...s, index: s.index - 1, selected: null } : s
}

export function forward(s: FinderState): FinderState {
  return s.index < s.history.length - 1 ? { ...s, index: s.index + 1, selected: null } : s
}

export const select = (s: FinderState, id: string | null): FinderState => ({ ...s, selected: id })
export const setView = (s: FinderState, view: FinderView): FinderState => ({ ...s, view })

export type FinderAction =
  | { type: 'navigate'; folderId: string }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'select'; id: string | null }
  | { type: 'view'; view: FinderView }

export function finderReducer(s: FinderState, a: FinderAction): FinderState {
  switch (a.type) {
    case 'navigate':
      return navigate(s, a.folderId)
    case 'back':
      return back(s)
    case 'forward':
      return forward(s)
    case 'select':
      return select(s, a.id)
    case 'view':
      return setView(s, a.view)
  }
}

export function quickLookTarget(nodeId: string): Command {
  return { type: 'app.open', appId: 'quicklook', props: { nodeId } }
}

// Only apps with a loader open their own windows; anything else previews in Quick Look.
export function openTarget(node: VNode): Command {
  if (node.kind === 'folder') return { type: 'finder.navigate', folderId: node.id }
  if (getApp(node.open.appId)?.load) {
    return { type: 'app.open', appId: node.open.appId, props: node.open.props }
  }
  return quickLookTarget(node.id)
}
