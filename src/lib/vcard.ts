export interface VCardInput {
  name: string
  title: string
  email: string
  location: string
  urls: { label: string; url: string }[]
}

// RFC 2426 text escaping; URLs are written raw.
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\r?\n/g, '\\n')

export function buildVCard(c: VCardInput): string {
  const parts = c.name.trim().split(/\s+/)
  const family = parts.pop() ?? ''
  const given = parts.join(' ')
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeText(family)};${escapeText(given)};;;`,
    `FN:${escapeText(c.name)}`,
    `TITLE:${escapeText(c.title)}`,
    `EMAIL;TYPE=INTERNET:${escapeText(c.email)}`,
    `ADR;TYPE=WORK:;;;${escapeText(c.location)};;;`,
    ...c.urls.flatMap((u, i) => [`item${i + 1}.URL:${u.url}`, `item${i + 1}.X-ABLabel:${u.label}`]),
    'END:VCARD',
  ]
  return lines.join('\r\n') + '\r\n'
}

export function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  // Revoke after the click has been handled; some browsers still read the URL during it.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
