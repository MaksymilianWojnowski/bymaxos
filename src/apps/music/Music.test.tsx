import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { MusicAlbum, MusicArtist, MusicPlaylist } from '../../content/types'
import MusicApp from './Music'

const state = vi.hoisted(() => ({
  artists: [] as MusicArtist[],
  albums: [] as MusicAlbum[],
  playlists: [] as MusicPlaylist[],
}))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (locale?: 'en') => ({ ...actual.getContent(locale), music: state }),
  }
})

const morning: MusicPlaylist = {
  id: 'p1',
  title: 'Morning',
  description: 'Coffee and slow starts',
  spotifyId: 'abc123',
  spotifyUrl: 'https://open.spotify.com/playlist/abc123',
  appleMusicUrl: 'https://music.apple.com/playlist/morning',
}
const night: MusicPlaylist = { id: 'p2', title: 'Night', appleMusicUrl: 'https://music.apple.com/playlist/night' }
const artistOne: MusicArtist = { id: 'a1', name: 'Artist One', url: 'https://music.apple.com/artist/one' }
const artistTwo: MusicArtist = { id: 'a2', name: 'Artist Two' }
const album: MusicAlbum = { id: 'al1', title: 'First Album', artist: 'Artist One', year: 2020 }

const detail = () => screen.getByRole('region', { name: 'Music detail' })
const sidebar = () => screen.getByRole('navigation', { name: 'Library' })

beforeEach(() => {
  state.artists = [artistOne, artistTwo]
  state.albums = [album]
  state.playlists = [morning, night]
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Music', () => {
  it('empty content shows "Music isn\'t configured yet." and no player', () => {
    state.artists = []
    state.albums = []
    state.playlists = []
    render(<MusicApp windowId="w1" />)

    expect(screen.getByText("Music isn't configured yet.")).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Library' })).toBeNull()
  })

  it('sidebar sections Playlists, Artists, Albums list the items and leave out empty sections', () => {
    state.albums = []
    render(<MusicApp windowId="w1" />)

    expect(within(sidebar()).getByRole('heading', { name: 'Playlists' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('heading', { name: 'Artists' })).toBeInTheDocument()
    expect(within(sidebar()).queryByRole('heading', { name: 'Albums' })).toBeNull()
    expect(within(sidebar()).getByRole('button', { name: 'Morning' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('button', { name: 'Night' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('button', { name: 'Artist Two' })).toBeInTheDocument()
  })

  it('shows the album section when albums exist', () => {
    render(<MusicApp windowId="w1" />)
    expect(within(sidebar()).getByRole('heading', { name: 'Albums' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('button', { name: 'First Album' })).toBeInTheDocument()
  })

  it('a playlist with links shows "Open in Spotify ↗" / "Open in Apple Music ↗" for the URLs that are set', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<MusicApp windowId="w1" />)

    await userEvent.click(within(sidebar()).getByRole('button', { name: 'Night' }))
    expect(within(detail()).queryByRole('button', { name: 'Open in Spotify ↗' })).toBeNull()
    await userEvent.click(within(detail()).getByRole('button', { name: 'Open in Apple Music ↗' }))
    expect(open).toHaveBeenCalledWith('https://music.apple.com/playlist/night', '_blank', 'noopener,noreferrer')

    await userEvent.click(within(sidebar()).getByRole('button', { name: 'Morning' }))
    await userEvent.click(within(detail()).getByRole('button', { name: 'Open in Spotify ↗' }))
    expect(open).toHaveBeenLastCalledWith('https://open.spotify.com/playlist/abc123', '_blank', 'noopener,noreferrer')
    expect(within(detail()).getByRole('button', { name: 'Open in Apple Music ↗' })).toBeInTheDocument()
  })

  it('a playlist with spotifyId shows "Load Spotify player" and no iframe until clicked; then the embed for that playlist appears', async () => {
    render(<MusicApp windowId="w1" />)
    await userEvent.click(within(sidebar()).getByRole('button', { name: 'Morning' }))

    expect(document.querySelector('iframe')).toBeNull()

    await userEvent.click(within(detail()).getByRole('button', { name: 'Load Spotify player' }))
    const frame = screen.getByTitle('Spotify player — Morning')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://open.spotify.com/embed/playlist/abc123')
    expect(frame).toHaveAttribute('loading', 'lazy')
    expect(frame).toHaveAttribute('allow', 'encrypted-media')
  })

  it('a playlist without spotifyId never offers the Spotify embed', async () => {
    render(<MusicApp windowId="w1" />)
    await userEvent.click(within(sidebar()).getByRole('button', { name: 'Night' }))
    expect(screen.queryByRole('button', { name: 'Load Spotify player' })).toBeNull()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('nothing renders a play button, progress bar or "Now Playing" text', async () => {
    render(<MusicApp windowId="w1" />)
    await userEvent.click(within(sidebar()).getByRole('button', { name: 'Morning' }))
    await userEvent.click(within(detail()).getByRole('button', { name: 'Load Spotify player' }))

    expect(screen.queryByRole('button', { name: /play/i })).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText(/now playing/i)).toBeNull()
  })

  it('props.item selects the matching item, and a new item resyncs the selection', () => {
    const { rerender } = render(<MusicApp windowId="w1" props={{ item: 'p2' }} />)
    expect(within(detail()).getByRole('heading', { name: 'Night', level: 2 })).toBeInTheDocument()

    rerender(<MusicApp windowId="w1" props={{ item: 'a1' }} />)
    expect(within(detail()).getByRole('heading', { name: 'Artist One', level: 2 })).toBeInTheDocument()
  })
})
