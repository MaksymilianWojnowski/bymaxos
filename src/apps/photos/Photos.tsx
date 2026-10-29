import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getContent } from '../../content'
import { allPhotos, photoUrl } from '../../system/photos'
import type { AppProps } from '../types'

const SWIPE_PX = 50
const NAV =
  'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/50 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white aria-disabled:opacity-40'

export default function PhotosApp({ props }: AppProps) {
  const albums = getContent().photoAlbums
  const everyPhoto = useMemo(() => allPhotos(albums), [albums])
  const itemId = typeof props?.item === 'string' ? props.item : undefined
  const [albumId, setAlbumId] = useState<string | null>(null)
  // Index into the photos on screen; null when the lightbox is closed.
  const [index, setIndex] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const swipeStart = useRef<number | null>(null)

  const album = albums.find((a) => a.id === albumId)
  const shown = album ? album.photos : everyPhoto
  const photo = index === null ? undefined : shown[index]
  const isOpen = photo !== undefined
  const last = shown.length - 1

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus()
  }, [isOpen])

  // Photos is a single window: a new item from Finder, Spotlight or Terminal arrives as new props.
  // Adjusted during render (not in an effect) so the lightbox opens in the same pass.
  const [seenItem, setSeenItem] = useState<string | undefined>(undefined)
  if (itemId !== seenItem) {
    setSeenItem(itemId)
    const i = everyPhoto.findIndex((p) => p.id === itemId)
    if (i >= 0) {
      setAlbumId(null)
      setIndex(i)
    }
  }

  const selectAlbum = (id: string | null) => {
    setAlbumId(id)
    setIndex(null)
  }

  const openAt = (i: number) => setIndex(i)

  // The grid is inert until the lightbox is gone, and browsers refuse focus on inert elements.
  // flushSync commits the close first, so the thumbnail for the photo last shown can take focus.
  const close = () => {
    const i = index
    flushSync(() => setIndex(null))
    if (i !== null) gridRef.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.focus()
  }

  // Previous and Next stay focusable at the ends (aria-disabled, not disabled), so focus never drops out.
  const move = (delta: number) => {
    const next = (index ?? 0) + delta
    if (index !== null && next >= 0 && next <= last) setIndex(next)
  }

  // Keys live on the lightbox itself: focus is inside it while open, so other windows keep their keys.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowLeft') move(-1)
    else if (e.key === 'ArrowRight') move(1)
    else if (e.key === 'Tab') {
      // Modal: Tab cycles through the lightbox buttons only.
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? [])
      const first = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement
      if (!first || !lastItem) return
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && (active === lastItem || !dialogRef.current?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // A drag to the left moves on, a drag to the right goes back; short drags are taps.
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (start === null) return
    const dx = start - e.clientX
    if (dx > SWIPE_PX) move(1)
    else if (dx < -SWIPE_PX) move(-1)
  }

  const title = album ? album.title : 'All Photos'
  const sidebarButton = (id: string | null, label: string) => (
    <button
      type="button"
      aria-current={albumId === id ? 'true' : undefined}
      onClick={() => selectAlbum(id)}
      className={`block w-full truncate rounded-[6px] px-2 py-1 text-left focus-visible:ring-2 focus-visible:ring-accent-link ${albumId === id ? 'bg-black/10 font-medium dark:bg-white/15' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-full min-h-0 bg-window font-sans text-[13px] text-text-1">
      <nav
        aria-label="Albums"
        inert={isOpen}
        className="w-[150px] shrink-0 overflow-auto border-r border-black/10 p-2 dark:border-white/15"
      >
        <ul className="flex flex-col gap-0.5">
          <li>{sidebarButton(null, 'All Photos')}</li>
          {albums.map((a) => (
            <li key={a.id}>{sidebarButton(a.id, a.title)}</li>
          ))}
        </ul>
      </nav>

      <section className="relative flex min-w-0 flex-1 flex-col">
        {everyPhoto.length === 0 ? (
          <p className="m-auto px-6 text-center text-text-2">Photos will appear here once they're added.</p>
        ) : (
          <>
            <h2 className="px-4 pt-3 text-[15px] font-semibold">{title}</h2>
            <div
              ref={gridRef}
              inert={isOpen}
              className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-2 overflow-auto p-3"
            >
              {shown.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openAt(i)}
                  className="aspect-square overflow-hidden rounded-[6px] focus-visible:ring-2 focus-visible:ring-accent-link"
                >
                  <img
                    src={photoUrl(p.src)}
                    alt={p.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </>
        )}

        {photo && index !== null && (
          // The lightbox lives inside the window and is modal there: the grid and sidebar are inert while it is open.
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={photo.alt}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            onPointerDown={(e) => {
              swipeStart.current = e.clientX
            }}
            onPointerUp={onPointerUp}
            className="absolute inset-0 z-10 flex flex-col bg-black/90 outline-none"
          >
            <div className="flex justify-end p-2">
              <button type="button" aria-label="Close" onClick={close} className={NAV}>
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center gap-2 px-2">
              <button
                type="button"
                aria-label="Previous photo"
                aria-disabled={index === 0 ? 'true' : undefined}
                onClick={() => move(-1)}
                className={NAV}
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
              <img
                src={photoUrl(photo.src)}
                alt={photo.alt}
                className="min-w-0 flex-1 self-stretch object-contain"
              />
              <button
                type="button"
                aria-label="Next photo"
                aria-disabled={index === last ? 'true' : undefined}
                onClick={() => move(1)}
                className={NAV}
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            {photo.caption && <p className="px-4 pb-3 pt-2 text-center text-[13px] text-white">{photo.caption}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
