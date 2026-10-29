import { useState } from 'react'
import { getContent } from '../../content'
import type { Place } from '../../content/types'
import { formatRange } from '../../lib/format'
import type { AppProps } from '../types'
import { MAP_H, MAP_W, project } from './project'
import { WORLD_PATH } from './worldPath'

const ROW = 'block w-full rounded-[6px] px-2 py-1.5 text-left focus-visible:ring-2 focus-visible:ring-accent-link'

// Newest first by start date; undated places go last. The sort is stable, so undated keep their content order.
const newestFirst = (a: Place, b: Place) => {
  if (a.from && b.from) return b.from.localeCompare(a.from)
  if (a.from) return -1
  if (b.from) return 1
  return 0
}

export default function MapsApp({ props }: AppProps) {
  const places = getContent().places
  const timeline = [...places].sort(newestFirst)
  const itemId = typeof props?.item === 'string' ? props.item : undefined
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Maps is a single window: a new item from Spotlight or Terminal arrives as new props.
  // Adjusted during render (not in an effect) so the selection changes in the same pass.
  const [seenItem, setSeenItem] = useState<string | undefined>(undefined)
  if (itemId !== seenItem) {
    setSeenItem(itemId)
    if (places.some((p) => p.id === itemId)) setSelectedId(itemId!)
  }

  if (places.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-window p-6 font-sans text-[13px] text-text-2">
        <p>No places yet.</p>
      </div>
    )
  }

  const selected = places.find((p) => p.id === selectedId) ?? timeline[0]

  return (
    <div className="flex h-full min-h-0 bg-window font-sans text-[13px] text-text-1">
      <nav aria-label="Travel timeline" className="w-[240px] shrink-0 overflow-auto border-r border-black/10 bg-window p-2 dark:border-white/15">
        <ol className="flex flex-col gap-0.5">
          {timeline.map((place) => {
            const active = place.id === selected.id
            return (
              <li key={place.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setSelectedId(place.id)}
                  className={`${ROW} ${active ? 'bg-accent-strong text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                  <span className="block truncate font-medium">{place.name}</span>
                  <span className={`block truncate text-[12px] ${active ? 'text-white' : 'text-text-2'}`}>
                    {place.from ? `${place.country} · ${formatRange(place.from, place.to)}` : place.country}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <section aria-label="Map" className="min-w-0 flex-1 overflow-auto p-5">
        {/* Pins live in a sibling layer, not inside the svg: role img makes its children presentational. */}
        <div className="relative w-full aspect-[2/1]">
          <svg role="img" aria-label="World map" viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full">
            <rect width={MAP_W} height={MAP_H} className="fill-[#a9cfe8] dark:fill-[#1c2a3a]" />
            <path d={WORLD_PATH} className="fill-[#e6e2d6] dark:fill-[#3a3f45]" />
          </svg>
          <div className="absolute inset-0">
            {places.map((place) => {
              const { x, y } = project(place.lat, place.lon)
              const active = place.id === selected.id
              return (
                <button
                  key={place.id}
                  type="button"
                  aria-label={place.name}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setSelectedId(place.id)}
                  style={{ left: `${(x / MAP_W) * 100}%`, top: `${(y / MAP_H) * 100}%` }}
                  className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-accent-link"
                >
                  <span
                    className={`block h-3 w-3 rounded-full border-2 border-white bg-[#d70015] transition-transform dark:bg-[#ff6961] ${active ? 'scale-125' : ''}`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <section aria-label="Place details" className="mt-4 rounded-[10px] border border-black/10 bg-window p-4 dark:border-white/15">
          <h2 className="text-[17px] font-semibold">{selected.name}</h2>
          <p className="mt-1 text-text-2">
            {selected.country}
            {selected.from && ` · ${formatRange(selected.from, selected.to)}`}
          </p>
          <p className="mt-2">{selected.note}</p>
        </section>
      </section>
    </div>
  )
}
