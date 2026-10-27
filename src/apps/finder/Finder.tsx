import { Fragment, useEffect, useId, useReducer, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Contact,
  FileText,
  FileType as FileTypeIcon,
  Files,
  Folder,
  Heart,
  Image as ImageIcon,
  Link,
  Monitor,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react'
import { dispatch, useWindowCommands, type HandlerRecord } from '../../system/commands'
import { useSystem } from '../../system/store'
import { pathTo, type FileType, type VNode } from '../../system/vfs'
import { useContextMenu } from '../../ui/useContextMenu'
import type { AppProps, MenuItemDef } from '../types'
import { finderReducer, initFinder, openTarget, quickLookTarget } from './finderState'
import { finderViews } from './menus'
import { nodeById, vfs } from './vfsInstance'

const SIDEBAR: { label: string; items: { id: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Favorites',
    items: [
      { id: 'desktop', icon: Monitor },
      { id: 'documents', icon: Files },
    ],
  },
  {
    label: 'bymaxOS',
    items: [
      { id: 'about', icon: User },
      { id: 'work', icon: Briefcase },
      { id: 'projects', icon: Folder },
      { id: 'photos', icon: ImageIcon },
      { id: 'interests', icon: Heart },
    ],
  },
  { label: 'Locations', items: [{ id: 'trash', icon: Trash2 }] },
]

const FILE_ICON: Record<FileType, LucideIcon> = {
  md: FileText,
  pdf: FileTypeIcon,
  vcf: Contact,
  webloc: Link,
}

const KIND: Record<FileType, string> = {
  md: 'Markdown Document',
  pdf: 'PDF Document',
  vcf: 'vCard',
  webloc: 'Web Location',
}

const iconOf = (node: VNode): LucideIcon => (node.kind === 'folder' ? Folder : FILE_ICON[node.fileType])
const kindOf = (node: VNode): string => (node.kind === 'folder' ? 'Folder' : KIND[node.fileType])

export default function FinderApp({ windowId, props }: AppProps) {
  const start = nodeById(props?.folderId)?.kind === 'folder' ? (props?.folderId as string) : 'desktop'
  const [state, send] = useReducer(finderReducer, start, initFinder)
  const setTitle = useSystem((s) => s.setTitle)
  const menu = useContextMenu()
  // The icons grid is measured for its column count; it is the only element whose layout matters here.
  const gridRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const optionId = (id: string) => `${uid}-${id}`

  const currentId = state.history[state.index]
  const current = nodeById(currentId)
  const folderName = current?.name ?? 'Finder'
  const children = current?.kind === 'folder' ? current.children : []
  const placeholder = current?.kind === 'folder' ? current.placeholder : undefined
  const selectedNode = nodeById(state.selected)
  const activeId = state.selected === null ? undefined : optionId(state.selected)
  const canBack = state.index > 0
  const canForward = state.index < state.history.length - 1

  useEffect(() => {
    setTitle(windowId, folderName)
  }, [windowId, folderName, setTitle])

  // The window's layout is published for the View menu's checkmark; the entry goes when the window closes.
  useEffect(() => {
    finderViews.set(windowId, state.view)
    return () => {
      finderViews.delete(windowId)
    }
  }, [windowId, state.view])

  const goTo = (folderId: string) => send({ type: 'navigate', folderId })

  const openNode = (id: string) => {
    const node = nodeById(id)
    if (!node) return
    if (node.kind === 'folder') goTo(id)
    else dispatch(openTarget(node))
  }

  // Menu and shortcut commands. Back and forward exist only when they can run, so their menu items disable.
  const handlers: HandlerRecord = {
    'file.newWindow': () => useSystem.getState().openApp('finder'),
    'finder.open': () => {
      if (state.selected !== null) openNode(state.selected)
    },
    'finder.navigate': (cmd) => {
      const folderId = cmd.folderId
      if (typeof folderId === 'string' && nodeById(folderId)?.kind === 'folder') goTo(folderId)
    },
    'view.icons': () => send({ type: 'view', view: 'icons' }),
    'view.list': () => send({ type: 'view', view: 'list' }),
  }
  if (canBack) handlers['finder.back'] = () => send({ type: 'back' })
  if (canForward) handlers['finder.forward'] = () => send({ type: 'forward' })
  useWindowCommands(windowId, handlers)

  // Columns are the tracks the browser laid out for the icons grid; the list view and an unlaid-out grid count as one.
  const columns = (): number => {
    if (state.view === 'list' || !gridRef.current) return 1
    const tracks = getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').filter(Boolean).length
    return Math.max(1, tracks)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const steps: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns(),
      ArrowDown: columns(),
    }
    const step = steps[e.key]
    if (step !== undefined) {
      e.preventDefault()
      if (children.length === 0) return
      const index = state.selected === null ? -1 : children.indexOf(state.selected)
      const next = index < 0 ? 0 : Math.min(children.length - 1, Math.max(0, index + step))
      send({ type: 'select', id: children[next] })
    } else if (e.key === 'Enter' && state.selected !== null) {
      e.preventDefault()
      openNode(state.selected)
    } else if (e.key === ' ' && selectedNode?.kind === 'file') {
      e.preventDefault()
      dispatch(quickLookTarget(selectedNode.id))
    }
  }

  const onItemContextMenu = (e: MouseEvent, node: VNode) => {
    send({ type: 'select', id: node.id })
    const items: MenuItemDef[] = [{ label: 'Open', command: { type: 'finder.open' } }]
    if (node.kind === 'file') {
      items.push(
        { label: 'Quick Look', command: quickLookTarget(node.id) },
        { label: 'Get Info', command: quickLookTarget(node.id) },
      )
    }
    menu.open(e, items)
  }

  const itemProps = (node: VNode) => ({
    id: optionId(node.id),
    onClick: () => send({ type: 'select', id: node.id }),
    onDoubleClick: () => openNode(node.id),
    onContextMenu: (e: MouseEvent) => onItemContextMenu(e, node),
  })

  const path = pathTo(vfs, currentId)

  return (
    <div className="flex h-full min-h-0 text-[13px] text-text-1">
      <aside aria-label="Sidebar" className="w-40 shrink-0 overflow-y-auto border-r border-black/10 bg-black/[0.03] p-2">
        {SIDEBAR.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-semibold text-text-2">{group.label}</p>
            {group.items.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={id === currentId ? 'page' : undefined}
                onClick={() => goTo(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent ${id === currentId ? 'bg-black/10' : 'hover:bg-black/5'}`}
              >
                <Icon aria-hidden className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">{vfs.nodes[id]?.name}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div role="toolbar" aria-label="Navigation" className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
          <button
            type="button"
            aria-label="Back"
            disabled={!canBack}
            onClick={() => send({ type: 'back' })}
            className="flex h-7 w-7 items-center justify-center rounded-md outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Forward"
            disabled={!canForward}
            onClick={() => send({ type: 'forward' })}
            className="flex h-7 w-7 items-center justify-center rounded-md outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
          <h2 className="flex-1 truncate text-center font-semibold">{folderName}</h2>
          <div role="group" aria-label="View" className="flex rounded-md bg-black/5 p-0.5">
            {(['icons', 'list'] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={state.view === view}
                onClick={() => send({ type: 'view', view })}
                className={`rounded px-2 py-0.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${state.view === view ? 'bg-white shadow-sm dark:bg-white/20' : ''}`}
              >
                {view === 'icons' ? 'Icons' : 'List'}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {children.length === 0 ? (
            placeholder && <p className="text-[13px] text-text-2">{placeholder}</p>
          ) : state.view === 'icons' ? (
            <div
              ref={gridRef}
              role="listbox"
              tabIndex={0}
              aria-label={`${folderName} items`}
              aria-activedescendant={activeId}
              onKeyDown={onKeyDown}
              className="grid grid-cols-[repeat(auto-fill,96px)] gap-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {children.map((id) => {
                const node = vfs.nodes[id]
                const Icon = iconOf(node)
                const selected = id === state.selected
                return (
                  <div
                    key={id}
                    role="option"
                    aria-selected={selected}
                    {...itemProps(node)}
                    className="flex w-24 cursor-default flex-col items-center gap-1 rounded-md p-1"
                  >
                    <Icon aria-hidden className="h-12 w-12 text-accent" />
                    <span
                      className={`line-clamp-2 rounded px-1 text-center text-[12px] break-words ${selected ? 'bg-accent text-white' : ''}`}
                    >
                      {node.name}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <table
              role="grid"
              tabIndex={0}
              aria-label={`${folderName} items`}
              aria-activedescendant={activeId}
              onKeyDown={onKeyDown}
              className="w-full border-collapse text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <thead>
                <tr className="border-b border-black/10 text-text-2">
                  <th scope="col" className="px-2 py-1 font-medium">Name</th>
                  <th scope="col" className="px-2 py-1 font-medium">Kind</th>
                </tr>
              </thead>
              <tbody>
                {children.map((id) => {
                  const node = vfs.nodes[id]
                  const Icon = iconOf(node)
                  const selected = id === state.selected
                  return (
                    <tr
                      key={id}
                      role="row"
                      aria-selected={selected}
                      {...itemProps(node)}
                      className={`cursor-default ${selected ? 'bg-accent text-white' : 'hover:bg-black/5'}`}
                    >
                      <td role="gridcell" className="px-2 py-1">
                        <span className="flex items-center gap-2">
                          <Icon aria-hidden className="h-4 w-4 shrink-0" />
                          {node.name}
                        </span>
                      </td>
                      <td role="gridcell" className="px-2 py-1 opacity-70">{kindOf(node)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <nav aria-label="Path" className="flex flex-wrap items-center gap-1 border-t border-black/10 px-3 py-1.5 text-[12px] text-text-2">
          {path.map((id, i) => (
            <Fragment key={id}>
              {i > 0 && <span aria-hidden="true">›</span>}
              {i === path.length - 1 ? (
                <span aria-current="location">{vfs.nodes[id]?.name}</span>
              ) : (
                <button type="button" onClick={() => goTo(id)} className="rounded px-1 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {vfs.nodes[id]?.name}
                </button>
              )}
            </Fragment>
          ))}
        </nav>
      </div>
      {menu.element}
    </div>
  )
}
