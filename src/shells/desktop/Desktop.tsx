import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { openTarget, quickLookTarget } from '../../apps/finder/finderState'
import { vfs } from '../../apps/finder/vfsInstance'
import type { MenuItemDef } from '../../apps/types'
import { dispatch, registerGlobal, type Command } from '../../system/commands'
import { getWorkArea } from '../../system/layout'
import { KEYS, safeStorage } from '../../system/storage'
import { useSystem } from '../../system/store'
import type { VNode } from '../../system/vfs'
import { useContextMenu } from '../../ui/useContextMenu'
import {
  CELL,
  cellToPx,
  clampCell,
  defaultPositions,
  loadIconPositions,
  placeIcon,
  pxToCell,
  stepInColumn,
  type Cell,
} from './desktopIcons'
import { iconFor } from './fileIcon'

const DRAG_THRESHOLD = 4
const DESKTOP_IDS = vfs.desktop

const EMPTY_MENU: MenuItemDef[] = [
  { label: 'Change Wallpaper…', command: { type: 'overlay.open', overlay: 'controlCenter' } },
  { label: 'Clean Up', command: { type: 'desktop.cleanUp' } },
  { separator: true },
  { label: 'About bymaxOS', command: { type: 'app.open', appId: 'about' } },
]

// finder.navigate only reaches a focused Finder, so a desktop folder opens its own Finder window.
const openCommand = (node: VNode): Command =>
  node.kind === 'folder'
    ? { type: 'app.open', appId: 'finder', props: { folderId: node.id } }
    : openTarget(node)

const savePositions = (positions: Record<string, Cell>) =>
  safeStorage.set('local', KEYS.icons, positions)

interface Gesture {
  id: string
  pointerId: number
  startX: number
  startY: number
  dragging: boolean
}

export function Desktop() {
  const viewport = useSystem((s) => s.viewport)
  const selected = useSystem((s) => s.selectedDesktopIcon)
  const select = useSystem((s) => s.selectDesktopIcon)
  const blurWindows = useSystem((s) => s.blurWindows)
  const area = getWorkArea(viewport.w, viewport.h)
  const [positions, setPositions] = useState(() => loadIconPositions(DESKTOP_IDS))
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const gesture = useRef<Gesture | null>(null)
  // A drag ends in a click on the icon; that click must neither select nor open.
  const justDragged = useRef(false)
  const menu = useContextMenu()
  const uid = useId()
  const optionId = (id: string) => `${uid}-${id}`

  useEffect(
    () =>
      registerGlobal('desktop.cleanUp', () => {
        const reset = defaultPositions(DESKTOP_IDS)
        setPositions(reset)
        savePositions(reset)
      }),
    [],
  )

  const openNode = (id: string) => dispatch(openCommand(vfs.nodes[id]))

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, id: string) => {
    if (e.button !== 0) return
    justDragged.current = false
    gesture.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (!g.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    g.dragging = true
    setDrag({ id: g.id, dx, dy })
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.pointerId !== e.pointerId) return
    gesture.current = null
    setDrag(null)
    if (!g.dragging || e.type === 'pointercancel') return
    justDragged.current = true
    const origin = cellToPx(clampCell(positions[g.id], area), area)
    const target = pxToCell(
      origin.x + e.clientX - g.startX,
      origin.y + e.clientY - g.startY,
      area,
    )
    const next = placeIcon(positions, g.id, target, area)
    setPositions(next)
    savePositions(next)
  }

  const onOptionClick = (id: string) => {
    if (!justDragged.current) select(id)
  }

  const onOptionContextMenu = (e: MouseEvent, id: string) => {
    select(id)
    menu.open(e, [
      { label: 'Open', command: openCommand(vfs.nodes[id]) },
      { label: 'Get Info', command: quickLookTarget(id) },
    ])
  }

  // Only the bare listbox counts as empty space; a click on an icon bubbles here with another target.
  const onSurfaceClick = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return
    select(null)
    blurWindows()
  }

  const onSurfaceContextMenu = (e: MouseEvent) => {
    if (e.target === e.currentTarget) menu.open(e, EMPTY_MENU)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = stepInColumn(positions, DESKTOP_IDS, selected, e.key === 'ArrowDown' ? 1 : -1)
      if (next !== undefined) select(next)
    } else if (e.key === 'Enter' && selected !== null) {
      e.preventDefault()
      openNode(selected)
    }
  }

  const activeId = selected === null ? undefined : optionId(selected)

  return (
    <>
      <div
        role="listbox"
        aria-label="Desktop"
        tabIndex={0}
        aria-activedescendant={activeId}
        onKeyDown={onKeyDown}
        onClick={onSurfaceClick}
        onContextMenu={onSurfaceContextMenu}
        className="absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {DESKTOP_IDS.map((id) => {
          const node = vfs.nodes[id]
          const Icon = iconFor(node)
          const isSelected = id === selected
          const { x, y } = cellToPx(clampCell(positions[id], area), area)
          const offset = drag?.id === id ? drag : null
          return (
            <div
              key={id}
              id={optionId(id)}
              role="option"
              aria-selected={isSelected}
              onPointerDown={(e) => onPointerDown(e, id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClick={() => onOptionClick(id)}
              onDoubleClick={() => openNode(id)}
              onContextMenu={(e) => onOptionContextMenu(e, id)}
              style={{
                left: x,
                top: y,
                width: CELL.w,
                height: CELL.h,
                transform: offset ? `translate(${offset.dx}px, ${offset.dy}px)` : undefined,
                zIndex: offset ? 1 : undefined,
              }}
              className={`absolute flex touch-none cursor-default select-none flex-col items-center gap-1 rounded-md p-1 ${isSelected ? 'bg-accent/30' : ''}`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-[14px] bg-white/90 text-accent shadow-md">
                <Icon aria-hidden className="h-9 w-9" />
              </div>
              <span
                className={`line-clamp-2 max-w-full break-words rounded px-1 text-center text-[12px] leading-tight text-white ${isSelected ? 'bg-accent' : ''}`}
                style={{ textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)' }}
              >
                {node.name}
              </span>
            </div>
          )
        })}
      </div>
      {menu.element}
    </>
  )
}
