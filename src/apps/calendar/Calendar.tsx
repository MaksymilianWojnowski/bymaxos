import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getContent } from '../../content'
import { monthGrid } from '../../lib/calendar'
import { dispatch } from '../../system/commands'

const BUTTON =
  'rounded-[6px] border border-black/15 bg-white px-3 py-1 text-[13px] text-black dark:border-white/15 dark:bg-[#2a2a2a] dark:text-white'
const ICON_BUTTON =
  'grid h-7 w-7 place-items-center rounded-[4px] text-text-2 hover:bg-black/5 dark:hover:bg-white/10'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface View {
  year: number
  month: number
}

const todayView = (): View => {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

const shift = (v: View, delta: number): View => {
  const d = new Date(v.year, v.month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

const monthTitle = ({ year, month }: View) =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1))

export default function CalendarApp() {
  const { profile, site } = getContent()
  const { calUrl, meetingTypes } = site.scheduling
  const firstName = profile.name.split(/\s+/)[0]
  const [view, setView] = useState(todayView)
  const now = new Date()
  const isToday = (day: number) =>
    view.year === now.getFullYear() && view.month === now.getMonth() && day === now.getDate()

  // Booking links are built only from configured Cal.com URLs; no slots are shown.
  const base = calUrl?.replace(/\/$/, '')
  const book = (path: string) => window.open(`${base}${path}`, '_blank', 'noopener,noreferrer')

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto bg-window p-5 font-sans text-[13px] text-text-1 md:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex items-center gap-2">
          <h2 className="flex-1 text-[16px] font-semibold">{monthTitle(view)}</h2>
          <button type="button" className={BUTTON} onClick={() => setView(todayView())}>
            Today
          </button>
          <button
            type="button"
            aria-label="Previous month"
            title="Previous month"
            className={ICON_BUTTON}
            onClick={() => setView((v) => shift(v, -1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next month"
            title="Next month"
            className={ICON_BUTTON}
            onClick={() => setView((v) => shift(v, 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <table role="grid" aria-label={monthTitle(view)} className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="pb-1 text-[11px] font-medium text-text-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(view.year, view.month).map((row, r) => (
              <tr key={r}>
                {row.map((day, c) => (
                  <td
                    key={c}
                    aria-current={day !== null && isToday(day) ? 'date' : undefined}
                    className="h-9 text-center align-middle"
                  >
                    {day !== null && (
                      <span
                        className={
                          isToday(day)
                            ? 'grid h-7 w-7 place-items-center mx-auto rounded-full bg-accent-link text-white'
                            : 'text-text-1'
                        }
                      >
                        {day}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <aside className="flex w-full flex-col gap-3 md:w-[200px] md:shrink-0">
        <h3 className="text-[14px] font-semibold">Meet {firstName}</h3>
        {!base ? (
          <>
            <p className="text-text-2">Online booking isn't set up yet — email to arrange a time.</p>
            <div>
              <button
                type="button"
                className={BUTTON}
                onClick={() => dispatch({ type: 'app.open', appId: 'mail' })}
              >
                Email {firstName}
              </button>
            </div>
          </>
        ) : meetingTypes.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {meetingTypes.map((t) => (
              <li key={t.id}>
                <button type="button" className={`${BUTTON} w-full text-left`} onClick={() => book(`/${t.slug}`)}>
                  {t.title} · {t.minutes} min
                </button>
                {t.description && <p className="mt-1 text-text-2">{t.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <button type="button" className={BUTTON} onClick={() => book('')}>
              Book a call
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
