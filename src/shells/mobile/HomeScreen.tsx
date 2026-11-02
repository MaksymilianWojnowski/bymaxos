import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from 'react'
import { Search } from 'lucide-react'
import { mobileDockApps, mobileHomeApps, mobileLinkApps } from '../../apps/registry'
import type { AppDefinition } from '../../apps/types'
import { getContent } from '../../content'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'
import { useClock } from '../desktop/statusHooks'
import { Wallpaper } from '../desktop/Wallpaper'
import { StatusBar } from './StatusBar'
import { pageFromScroll } from './gestures'

const { profile } = getContent()
const HOME_APPS = mobileHomeApps()
const LINK_APPS = mobileLinkApps()
const DOCK_APPS = mobileDockApps()
const PAGES = 2
// A downward pull on page 1 of more than this many px opens search.
const PULL_SEARCH = 60
// Upper bound for a page change's smooth scroll; scrollend is missing in some browsers.
const FLIGHT_MS = 500
// Page content keeps its 16px gutter, or the notch inset in landscape when that is larger.
const PAGE_PAD =
  'py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]'
const ROW_PAD = 'pl-[max(0px,env(safe-area-inset-left))] pr-[max(0px,env(safe-area-inset-right))]'

const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const month = new Intl.DateTimeFormat('en-US', { month: 'long' })
const TILE = 'focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none active:scale-95'

// An app's grid cell: the icon over a white label with a shadow, as the wallpaper is behind both.
function AppCell({ app, onOpen }: { app: AppDefinition; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(app.id)}
        className={`flex min-h-11 w-full flex-col items-center gap-1.5 rounded-[14px] text-white ${TILE}`}
      >
        <AppIcon app={app} size={60} />
        <span className="text-center text-[12px] leading-tight font-medium drop-shadow-md">{app.name}</span>
      </button>
    </li>
  )
}

// Page 1 holds the widgets and the home apps; page 2 the social links.
export function HomeScreen({ onSearch }: { onSearch: () => void }) {
  const openMobileApp = useSystem((s) => s.openMobileApp)
  const reduceMotion = useSystem((s) => s.settings.reduceMotion)
  const now = useClock()
  const scroller = useRef<HTMLDivElement>(null)
  const pullStart = useRef<{ x: number; y: number } | null>(null)
  const [page, setPage] = useState(0)

  // A programmatic scroll reports intermediate offsets, so the page is read only once that scroll has landed.
  const flight = useRef<number | null>(null)

  const landed = useCallback(() => {
    if (flight.current !== null) window.clearTimeout(flight.current)
    flight.current = null
    const el = scroller.current
    if (el) setPage(pageFromScroll(el.scrollLeft, el.clientWidth, PAGES))
  }, [])

  useEffect(() => {
    const el = scroller.current
    el?.addEventListener('scrollend', landed)
    return () => {
      el?.removeEventListener('scrollend', landed)
      if (flight.current !== null) window.clearTimeout(flight.current)
    }
  }, [landed])

  const goTo = (i: number) => {
    const el = scroller.current
    setPage(i)
    if (!el) return
    el.scrollLeft = el.clientWidth * i
    // Under reduce-motion the jump is instant, so nothing is in flight.
    if (reduceMotion) return
    if (flight.current !== null) window.clearTimeout(flight.current)
    flight.current = window.setTimeout(landed, FLIGHT_MS)
  }

  const onScroll = () => {
    const el = scroller.current
    if (el && flight.current === null) setPage(pageFromScroll(el.scrollLeft, el.clientWidth, PAGES))
  }

  // Roving focus over the page dots: Left and Right move the page and its dot together.
  const onDotKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number
    if (e.key === 'ArrowRight') next = (page + 1) % PAGES
    else if (e.key === 'ArrowLeft') next = (page - 1 + PAGES) % PAGES
    else return
    e.preventDefault()
    goTo(next)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  // Only a mostly vertical drag from the top of page 1 counts as a pull, so horizontal paging is left alone.
  const onPullStart = (e: TouchEvent<HTMLElement>) => {
    const touch = e.touches[0]
    pullStart.current = e.currentTarget.scrollTop <= 0 && touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  const onPullEnd = (e: TouchEvent<HTMLElement>) => {
    const start = pullStart.current
    const touch = e.changedTouches[0]
    pullStart.current = null
    if (!start || !touch) return
    const dy = touch.clientY - start.y
    if (dy > PULL_SEARCH && dy > Math.abs(touch.clientX - start.x)) onSearch()
  }


  return (
    <div className="relative h-full w-full overflow-hidden text-white">
      <Wallpaper />
      <div aria-hidden="true" className="absolute inset-0 bg-[rgb(0_0_0/0.4)]" />

      <div className="absolute inset-0 flex flex-col">
        <StatusBar onWallpaper />

        <div
          ref={scroller}
          onScroll={onScroll}
          style={{ scrollBehavior: reduceMotion ? 'auto' : 'smooth' }}
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
        >
          <section
            onTouchStart={onPullStart}
            onTouchEnd={onPullEnd}
            onTouchCancel={() => {
              pullStart.current = null
            }}
            className="h-full w-full shrink-0 snap-start overflow-y-auto"
          >
            <ul className={`grid grid-cols-4 gap-x-3 gap-y-5 ${PAGE_PAD} [@media(max-height:500px)]:grid-cols-6`}>
              <li className="col-span-full">
                <button
                  type="button"
                  onClick={() => openMobileApp('resume')}
                  className={`block w-full rounded-[18px] bg-black/30 p-4 text-left drop-shadow-md ${TILE}`}
                >
                  <span className="block text-[17px] font-semibold">{profile.name}</span>
                  <span className="block text-[13px] text-white/90">{profile.headline}</span>
                  <span className="sr-only"> — open Resume</span>
                </button>
              </li>
              <li className="col-span-2 row-span-2">
                <button
                  type="button"
                  onClick={() => openMobileApp('calendar')}
                  className={`flex h-full w-full flex-col justify-between rounded-[18px] bg-black/30 p-3 text-left drop-shadow-md ${TILE}`}
                >
                  <span className="text-[13px] font-semibold uppercase">{weekdayShort.format(now)}</span>
                  <span className="text-[44px] leading-none font-light">{now.getDate()}</span>
                  <span className="text-[13px]">{month.format(now)}</span>
                  <span className="sr-only"> — open Calendar</span>
                </button>
              </li>
              {HOME_APPS.map((app) => (
                <AppCell key={app.id} app={app} onOpen={openMobileApp} />
              ))}
            </ul>
          </section>

          <section className="h-full w-full shrink-0 snap-start overflow-y-auto">
            <ul className={`grid grid-cols-4 gap-x-3 gap-y-5 ${PAGE_PAD}`}>
              {LINK_APPS.map((app) => (
                <AppCell key={app.id} app={app} onOpen={openMobileApp} />
              ))}
            </ul>
          </section>
        </div>

        {/* In landscape the page dots and the Search pill share one row, so the short screen keeps its grid height. */}
        <div
          className={`flex flex-col items-center [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:justify-center [@media(max-height:500px)]:gap-3 ${ROW_PAD}`}
        >
          <div role="tablist" aria-label="Home screen pages" onKeyDown={onDotKey} className="flex justify-center">
            {Array.from({ length: PAGES }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-label={`Page ${i + 1}`}
                aria-selected={page === i}
                tabIndex={page === i ? 0 : -1}
                onClick={() => goTo(i)}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              >
                <span className={`h-2 w-2 rounded-full bg-white ${page === i ? 'opacity-100' : 'opacity-50'}`} />
              </button>
            ))}
          </div>

          <div className="flex justify-center py-2 [@media(max-height:500px)]:py-0">
            <button
              type="button"
              onClick={onSearch}
              className={`flex min-h-11 items-center gap-1.5 rounded-full bg-black/40 px-4 text-[15px] font-medium ${TILE}`}
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Search
            </button>
          </div>
        </div>

        <div
          role="toolbar"
          aria-label="Dock"
          className="mb-2 ml-[max(0.75rem,env(safe-area-inset-left))] mr-[max(0.75rem,env(safe-area-inset-right))] flex justify-around rounded-[24px] border px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            borderColor: 'var(--glass-border)',
          }}
        >
          {DOCK_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              aria-label={app.name}
              onClick={() => openMobileApp(app.id)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-[14px] focus-visible:ring-2 focus-visible:ring-accent-link focus-visible:outline-none dark:focus-visible:ring-white active:scale-95"
            >
              <AppIcon app={app} size={56} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
