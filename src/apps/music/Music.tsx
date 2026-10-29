import { useEffect, useRef, useState } from 'react'
import { getContent } from '../../content'
import type { AppProps } from '../types'

type Selection = { kind: 'playlist' | 'artist' | 'album'; id: string }

const BUTTON =
  'rounded-[6px] border border-black/15 bg-white px-3 py-1 text-[13px] text-black focus-visible:ring-2 focus-visible:ring-accent-link dark:border-white/15 dark:bg-[#2a2a2a] dark:text-white'
const ROW = 'block w-full truncate rounded-[6px] px-2 py-1 text-left focus-visible:ring-2 focus-visible:ring-accent-link'

const openLink = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

export default function MusicApp({ props }: AppProps) {
  const { artists, albums, playlists } = getContent().music
  const itemId = typeof props?.item === 'string' ? props.item : undefined
  const [selected, setSelected] = useState<Selection | null>(() => {
    const first = playlists[0] ?? artists[0] ?? albums[0]
    if (!first) return null
    const kind = playlists[0] ? 'playlist' : artists[0] ? 'artist' : 'album'
    return { kind, id: first.id }
  })
  // The Spotify embed loads only after a click, and is reset whenever the selection changes.
  const [embedded, setEmbedded] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // The Load button unmounts on click, so focus moves to the player it reveals (WCAG 2.4.3).
  useEffect(() => {
    if (embedded) frameRef.current?.focus()
  }, [embedded])

  const choose = (next: Selection | null) => {
    setSelected(next)
    setEmbedded(false)
  }

  // Music is a single window: a new item from Spotlight or Terminal arrives as new props.
  // Adjusted during render (not in an effect) so the selection changes in the same pass.
  const [seenItem, setSeenItem] = useState<string | undefined>(undefined)
  if (itemId !== seenItem) {
    setSeenItem(itemId)
    const hit: Selection | undefined =
      playlists.some((p) => p.id === itemId) ? { kind: 'playlist', id: itemId! }
      : artists.some((a) => a.id === itemId) ? { kind: 'artist', id: itemId! }
      : albums.some((a) => a.id === itemId) ? { kind: 'album', id: itemId! }
      : undefined
    if (hit) choose(hit)
  }

  if (playlists.length + artists.length + albums.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-window p-6 font-sans text-[13px] text-text-2">
        <p>Music isn't configured yet.</p>
      </div>
    )
  }

  const isSelected = (kind: Selection['kind'], id: string) => selected?.kind === kind && selected.id === id

  const sidebarRow = (kind: Selection['kind'], id: string, label: string) => {
    const active = isSelected(kind, id)
    return (
      <li key={id}>
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          onClick={() => choose({ kind, id })}
          className={`${ROW} ${active ? 'bg-accent-strong text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
        >
          {label}
        </button>
      </li>
    )
  }

  const playlist = selected?.kind === 'playlist' ? playlists.find((p) => p.id === selected.id) : undefined
  const artist = selected?.kind === 'artist' ? artists.find((a) => a.id === selected.id) : undefined
  const album = selected?.kind === 'album' ? albums.find((a) => a.id === selected.id) : undefined

  return (
    <div className="flex h-full min-h-0 bg-window font-sans text-[13px] text-text-1">
      <nav aria-label="Library" className="w-[170px] shrink-0 overflow-auto border-r border-black/10 p-2 dark:border-white/15">
        {playlists.length > 0 && (
          <section className="mb-3">
            <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase text-text-2">Playlists</h2>
            <ul className="flex flex-col gap-0.5">{playlists.map((p) => sidebarRow('playlist', p.id, p.title))}</ul>
          </section>
        )}
        {artists.length > 0 && (
          <section className="mb-3">
            <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase text-text-2">Artists</h2>
            <ul className="flex flex-col gap-0.5">{artists.map((a) => sidebarRow('artist', a.id, a.name))}</ul>
          </section>
        )}
        {albums.length > 0 && (
          <section className="mb-3">
            <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase text-text-2">Albums</h2>
            <ul className="flex flex-col gap-0.5">{albums.map((a) => sidebarRow('album', a.id, a.title))}</ul>
          </section>
        )}
      </nav>

      <section aria-label="Music detail" tabIndex={0} className="min-w-0 flex-1 overflow-auto p-5">
        {playlist && (
          <>
            <h2 className="text-[17px] font-semibold">{playlist.title}</h2>
            {playlist.description && <p className="mt-1 text-text-2">{playlist.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {playlist.spotifyUrl && (
                <button type="button" className={BUTTON} onClick={() => openLink(playlist.spotifyUrl!)}>
                  Open in Spotify ↗
                </button>
              )}
              {playlist.appleMusicUrl && (
                <button type="button" className={BUTTON} onClick={() => openLink(playlist.appleMusicUrl!)}>
                  Open in Apple Music ↗
                </button>
              )}
              {playlist.spotifyId && !embedded && (
                <button type="button" className={BUTTON} onClick={() => setEmbedded(true)}>
                  Load Spotify player
                </button>
              )}
            </div>
            {playlist.spotifyId && embedded && (
              <iframe
                ref={frameRef}
                key={playlist.id}
                title={`Spotify player — ${playlist.title}`}
                src={`https://open.spotify.com/embed/playlist/${playlist.spotifyId}`}
                loading="lazy"
                allow="encrypted-media"
                className="mt-4 h-[352px] w-full rounded-[10px] border-0"
              />
            )}
          </>
        )}
        {artist && (
          <>
            <h2 className="text-[17px] font-semibold">{artist.name}</h2>
            {artist.url && (
              <div className="mt-4">
                <button type="button" className={BUTTON} onClick={() => openLink(artist.url!)}>
                  Open link ↗
                </button>
              </div>
            )}
          </>
        )}
        {album && (
          <>
            <h2 className="text-[17px] font-semibold">{album.title}</h2>
            <p className="mt-1 text-text-2">
              {album.artist}
              {album.year !== undefined && ` · ${album.year}`}
            </p>
            {album.url && (
              <div className="mt-4">
                <button type="button" className={BUTTON} onClick={() => openLink(album.url!)}>
                  Open link ↗
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
