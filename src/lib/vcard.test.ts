import { describe, expect, it } from 'vitest'
import { buildVCard } from './vcard'

const card = {
  name: 'Maksymilian Wojnowski',
  title: 'Lead Frontend Developer',
  email: 'maksymilianwojnowski@gmail.com',
  location: 'Wrocław, Poland',
  urls: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/x/' }],
}

describe('buildVCard', () => {
  it('builds a vCard 3.0 with CRLF line endings', () => {
    expect(buildVCard(card)).toBe(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:Wojnowski;Maksymilian;;;',
        'FN:Maksymilian Wojnowski',
        'TITLE:Lead Frontend Developer',
        'EMAIL;TYPE=INTERNET:maksymilianwojnowski@gmail.com',
        'ADR;TYPE=WORK:;;;Wrocław\\, Poland;;;',
        'item1.URL:https://www.linkedin.com/in/x/',
        'item1.X-ABLabel:LinkedIn',
        'END:VCARD',
        '',
      ].join('\r\n'),
    )
  })

  it('escapes backslash, comma, semicolon and newline in text values', () => {
    const out = buildVCard({ ...card, title: 'A; B, C\\D\nE' })
    expect(out).toContain('TITLE:A\\; B\\, C\\\\D\\nE\r\n')
  })

  it('puts the location in the ADR locality field', () => {
    const adr = buildVCard(card)
      .split('\r\n')
      .find((l) => l.startsWith('ADR'))
    expect(adr?.split(':')[1].split(';')[3]).toBe('Wrocław\\, Poland')
  })

  it('never contains a TEL line', () => {
    expect(buildVCard(card)).not.toMatch(/^TEL/m)
  })
})
