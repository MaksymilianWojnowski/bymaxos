import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatRange } from '../../lib/format'
import type { Place } from '../../content/types'
import MapsApp from './Maps'

const state = vi.hoisted(() => ({ places: [] as Place[] }))

vi.mock('../../content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content')>()
  return {
    ...actual,
    getContent: (locale?: 'en') => ({ ...actual.getContent(locale), places: state.places }),
  }
})

const wroclaw: Place = { id: 'wroclaw', name: 'Wrocław', country: 'Poland', lat: 51.1079, lon: 17.0385, note: 'Home base.' }
const kraków: Place = { id: 'krakow', name: 'Kraków', country: 'Poland', lat: 50.0647, lon: 19.945, note: 'Old town visit.' }
const tokyo: Place = {
  id: 'tokyo',
  name: 'Tokyo',
  country: 'Japan',
  lat: 35.6762,
  lon: 139.6503,
  from: '2025-03',
  to: '2025-08',
  note: 'Exchange semester.',
}
const berlin: Place = { id: 'berlin', name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, from: '2019-09', to: '2021-06', note: 'Internship.' }

const map = () => screen.getByRole('img', { name: 'World map' })
const timeline = () => screen.getByRole('navigation', { name: 'Travel timeline' })
const pin = (name: string) => screen.getByRole('button', { name })
const entry = (name: string) => within(timeline()).getByRole('button', { name: new RegExp(`^${name}`) })
const detail = () => screen.getByRole('region', { name: 'Place details' })

beforeEach(() => {
  state.places = [wroclaw, tokyo, kraków, berlin]
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Maps', () => {
  it('renders an svg map (role img, name "World map") with one pin button per place, named by place name', () => {
    render(<MapsApp windowId="w1" />)

    expect(map().tagName.toLowerCase()).toBe('svg')
    for (const place of state.places) {
      expect(pin(place.name)).toBeInTheDocument()
    }
    // Role img makes its children presentational, so the pins must sit outside the svg.
    expect(within(map()).queryByRole('button')).toBeNull()
  })

  it('the timeline lists places newest first by from (undated last), each with formatRange(from, to) when dated', () => {
    render(<MapsApp windowId="w1" />)

    const names = within(timeline())
      .getAllByRole('button')
      .map((b) => b.querySelector('span')?.textContent)
    expect(names).toEqual(['Tokyo', 'Berlin', 'Wrocław', 'Kraków'])
    expect(entry('Tokyo')).toHaveTextContent(formatRange('2025-03', '2025-08'))
    expect(entry('Berlin')).toHaveTextContent(formatRange('2019-09', '2021-06'))
    expect(entry('Wrocław')).not.toHaveTextContent('–')
  })

  it('selecting a pin selects its timeline entry and shows a detail card (name, country, dates, note), and vice versa', async () => {
    render(<MapsApp windowId="w1" />)

    await userEvent.click(pin('Tokyo'))
    expect(entry('Tokyo')).toHaveAttribute('aria-current', 'true')
    expect(within(detail()).getByRole('heading', { name: 'Tokyo' })).toBeInTheDocument()
    expect(detail()).toHaveTextContent('Japan')
    expect(detail()).toHaveTextContent(formatRange('2025-03', '2025-08'))
    expect(detail()).toHaveTextContent('Exchange semester.')

    await userEvent.click(entry('Berlin'))
    expect(entry('Berlin')).toHaveAttribute('aria-current', 'true')
    expect(entry('Tokyo')).not.toHaveAttribute('aria-current')
    expect(pin('Berlin')).toHaveAttribute('aria-current', 'true')
    expect(within(detail()).getByRole('heading', { name: 'Berlin' })).toBeInTheDocument()
  })

  it('props.item selects that place', () => {
    render(<MapsApp windowId="w1" props={{ item: 'krakow' }} />)

    expect(within(detail()).getByRole('heading', { name: 'Kraków' })).toBeInTheDocument()
    expect(entry('Kraków')).toHaveAttribute('aria-current', 'true')
  })

  it('a new props.item while the window is open selects that place', () => {
    const { rerender } = render(<MapsApp windowId="w1" props={{ item: 'tokyo' }} />)
    expect(within(detail()).getByRole('heading', { name: 'Tokyo' })).toBeInTheDocument()

    rerender(<MapsApp windowId="w1" props={{ item: 'wroclaw' }} />)
    expect(within(detail()).getByRole('heading', { name: 'Wrocław' })).toBeInTheDocument()
  })

  it('with no places shows "No places yet."', () => {
    state.places = []
    render(<MapsApp windowId="w1" />)

    expect(screen.getByText('No places yet.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'World map' })).toBeNull()
  })
})
