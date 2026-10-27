const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Built by hand: Intl output varies with the runtime's ICU data, and the menu bar must read the same everywhere.
export function formatMenuClock(d: Date): string {
  const hours = d.getHours()
  const hour12 = hours % 12 || 12
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const period = hours < 12 ? 'AM' : 'PM'
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}  ${hour12}:${minutes} ${period}`
}
