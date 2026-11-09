import { useClock } from '../shells/desktop/statusHooks'
import { useShell } from '../system/shell'

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'

// Drawn as an image, like the PNG it replaces: DOM text would be checked by axe as UI.
export function CalendarIcon({ size, dark }: { size: number; dark?: boolean }) {
  const now = useClock()
  const shell = useShell()
  const label = shell === 'mobile' ? WEEKDAY.format(now) : MONTH.format(now).toUpperCase()
  const pad = size * 0.1
  const tile = size * 0.8
  const shadow = Math.round(size * 3) / 100
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    '<defs><filter id="s" x="-20%" y="-20%" width="140%" height="150%">' +
    `<feDropShadow dx="0" dy="${shadow}" stdDeviation="${shadow}" flood-color="#000" flood-opacity="0.25"/></filter></defs>` +
    `<rect x="${pad}" y="${pad}" width="${tile}" height="${tile}" rx="${tile * 0.225}" ` +
    `fill="${dark ? '#1c1c1e' : '#ffffff'}" filter="url(#s)"/>` +
    `<text x="${size / 2}" y="${pad + tile * 0.28}" text-anchor="middle" font-family='${FONT}' ` +
    `font-size="${size * 0.13}" font-weight="600" fill="#ff3b30">${label}</text>` +
    `<text x="${size / 2}" y="${pad + tile * 0.8}" text-anchor="middle" font-family='${FONT}' ` +
    `font-size="${size * 0.42}" font-weight="300" fill="${dark ? '#ffffff' : '#1d1d1f'}">${now.getDate()}</text>` +
    '</svg>'
  return (
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ width: size, height: size }}
    />
  )
}
