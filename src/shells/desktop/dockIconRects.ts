import type { AppId } from '../../system/types'

// Written by the Dock, read by Window for the minimize animation.
export const dockIconRects = new Map<AppId, DOMRect>()
