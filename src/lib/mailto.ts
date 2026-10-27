// Line breaks become CRLF, the form mail clients expect in mailto bodies.
export function buildMailto(m: { to: string; subject: string; body: string }): string {
  const body = m.body.replace(/\r?\n/g, '\r\n')
  return `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(body)}`
}
