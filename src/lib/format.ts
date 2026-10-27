const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// 'YYYY-MM' -> 'Oct 2025'
export function formatMonth(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  return MONTH.format(new Date(year, month - 1, 1))
}

// Open-ended ranges end in 'Present'.
export function formatRange(start: string, end?: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`
}

// ISO timestamp -> 'Oct 12, 2026' in the local time zone.
export function formatDate(iso: string): string {
  return DAY.format(new Date(iso))
}
