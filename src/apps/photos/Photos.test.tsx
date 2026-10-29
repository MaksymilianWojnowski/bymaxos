import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Photo, PhotoAlbum } from '../../content/types'
import PhotosApp from './Photos'

const state = vi.hoisted(() => ({ albums: [] as PhotoAlbum[] }))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (locale?: 'en') => ({ ...actual.getContent(locale), photoAlbums: state.albums }),
  }
})

const photo = (id: string, alt: string, caption?: string): Photo => ({ id, src: `photos/${id}.jpg`, alt, width: 3, height: 2, caption })
const trips: PhotoAlbum = { id: 'trips', title: 'Trips', photos: [photo('t1', 'Alpha'), photo('t2', 'Beta'), photo('t3', 'Gamma', 'Dusk')] }
const city: PhotoAlbum = { id: 'city', title: 'City', photos: [photo('c1', 'Delta')] }

const sidebar = () => screen.getByRole('navigation', { name: 'Albums' })
const dialog = () => screen.queryByRole('dialog')
const thumb = (alt: string) => screen.getByRole('button', { name: alt })
const lightboxButton = (name: string) => within(dialog() as HTMLElement).getByRole('button', { name })
const isAriaDisabled = (name: string) => lightboxButton(name).getAttribute('aria-disabled') === 'true'

beforeEach(() => {
  state.albums = [trips, city]
})

afterEach(() => {
  cleanup()
})

describe('Photos', () => {
  it('shows the empty copy and no grid when there are no photos', () => {
    state.albums = []
    render(<PhotosApp windowId="w1" />)

    expect(screen.getByText("Photos will appear here once they're added.")).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('sidebar lists All Photos and each album; the grid shows lazy images with alt text', async () => {
    render(<PhotosApp windowId="w1" />)

    expect(within(sidebar()).getByRole('button', { name: 'All Photos' })).toHaveAttribute('aria-current', 'true')
    expect(within(sidebar()).getByRole('button', { name: 'Trips' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('button', { name: 'City' })).toBeInTheDocument()

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(4)
    for (const img of images) expect(img).toHaveAttribute('loading', 'lazy')
    expect(screen.getByRole('img', { name: 'Alpha' })).toHaveAttribute('src', `${import.meta.env.BASE_URL}photos/t1.jpg`)

    await userEvent.click(within(sidebar()).getByRole('button', { name: 'City' }))
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('clicking a thumbnail opens a lightbox dialog named by the photo alt; arrows move; Escape closes and returns focus', async () => {
    render(<PhotosApp windowId="w1" />)
    await userEvent.click(thumb('Alpha'))

    expect(dialog()).toHaveAccessibleName('Alpha')
    expect(dialog()).toHaveAttribute('aria-modal', 'true')
    expect(isAriaDisabled('Previous photo')).toBe(true)

    await userEvent.keyboard('{ArrowRight}')
    expect(dialog()).toHaveAccessibleName('Beta')
    await userEvent.click(lightboxButton('Next photo'))
    expect(dialog()).toHaveAccessibleName('Gamma')
    expect(within(dialog() as HTMLElement).getByText('Dusk')).toBeInTheDocument()

    // All Photos ends with Delta from the City album; Next stays focusable but is aria-disabled.
    await userEvent.keyboard('{ArrowRight}')
    expect(dialog()).toHaveAccessibleName('Delta')
    expect(isAriaDisabled('Next photo')).toBe(true)
    await userEvent.click(lightboxButton('Next photo'))
    expect(dialog()).toHaveAccessibleName('Delta')
    expect(lightboxButton('Next photo')).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(dialog()).toBeNull()
    expect(thumb('Alpha')).toHaveFocus()
  })

  it('a horizontal swipe moves to the next photo, and the reverse swipe to the previous', async () => {
    render(<PhotosApp windowId="w1" />)
    await userEvent.click(thumb('Alpha'))

    fireEvent.pointerDown(dialog() as HTMLElement, { clientX: 200 })
    fireEvent.pointerUp(dialog() as HTMLElement, { clientX: 100 })
    expect(dialog()).toHaveAccessibleName('Beta')

    fireEvent.pointerDown(dialog() as HTMLElement, { clientX: 100 })
    fireEvent.pointerUp(dialog() as HTMLElement, { clientX: 200 })
    expect(dialog()).toHaveAccessibleName('Alpha')
  })

  it('props.item opens the lightbox on that photo', () => {
    render(<PhotosApp windowId="w1" props={{ item: 't2' }} />)
    expect(dialog()).toHaveAccessibleName('Beta')
  })

  it('a new props.item while Photos is open shows that photo', () => {
    const { rerender } = render(<PhotosApp windowId="w1" props={{ item: 't2' }} />)
    expect(dialog()).toHaveAccessibleName('Beta')

    rerender(<PhotosApp windowId="w1" props={{ item: 'c1' }} />)
    expect(dialog()).toHaveAccessibleName('Delta')
    expect(within(sidebar()).getByRole('button', { name: 'All Photos' })).toHaveAttribute('aria-current', 'true')
  })

  it('keys outside the lightbox are not taken: ArrowRight and Escape from a focused input elsewhere do nothing', async () => {
    render(
      <>
        <input aria-label="Outside" />
        <PhotosApp windowId="w1" />
      </>,
    )
    await userEvent.click(thumb('Alpha'))
    await userEvent.click(screen.getByRole('textbox', { name: 'Outside' }))

    await userEvent.keyboard('{ArrowRight}')
    expect(dialog()).toHaveAccessibleName('Alpha')
    await userEvent.keyboard('{Escape}')
    expect(dialog()).toHaveAccessibleName('Alpha')
  })

  it('while the lightbox is open the sidebar and grid are inert, and Tab wraps within the lightbox buttons', async () => {
    render(<PhotosApp windowId="w1" />)
    await userEvent.click(thumb('Alpha'))

    expect(sidebar()).toHaveAttribute('inert')
    // The grid is inert as a whole, so its thumbnails sit under an inert ancestor.
    expect(thumb('Beta').closest('[inert]')).not.toBeNull()

    lightboxButton('Next photo').focus()
    await userEvent.tab()
    expect(lightboxButton('Close')).toHaveFocus()

    await userEvent.tab({ shift: true })
    expect(lightboxButton('Next photo')).toHaveFocus()
  })
})
