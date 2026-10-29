import { describe, expect, it } from 'vitest'
import { parseAddress } from './address'

const ERROR = { ok: false, error: 'Enter a web address starting with https://' }

describe('parseAddress', () => {
  it('trims the input and normalises an https URL', () => {
    expect(parseAddress('  https://x.com  ')).toEqual({ ok: true, url: 'https://x.com/' })
  })

  it('accepts http URLs with a path and query', () => {
    expect(parseAddress('http://a.b/c?d')).toEqual({ ok: true, url: 'http://a.b/c?d' })
  })

  it.each(['linkedin', 'javascript:alert(1)', 'ftp://x', ''])('rejects %j', (input) => {
    expect(parseAddress(input)).toEqual(ERROR)
  })
})
