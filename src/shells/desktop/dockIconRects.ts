import type { AppId } from '../../system/types'

// Written by the Dock, read by Window for the minimize animation.
export const dockIconRects = new Map<AppId, DOMRect>()

// The live icon when the Dock has it mounted (magnification and resizing move it), else the last measured rect.
export function dockIconRect(appId: AppId): DOMRect | undefined {
  const el = document.querySelector(`[data-dock-app="${appId}"]`)
  return el ? el.getBoundingClientRect() : dockIconRects.get(appId)
}
