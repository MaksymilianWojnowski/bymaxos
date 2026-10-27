import { describe, expect, it } from 'vitest'
import { buildMailto } from './mailto'

describe('buildMailto', () => {
  it('encodes subject and body', () => {
    expect(
      buildMailto({
        to: 'maksymilianwojnowski@gmail.com',
        subject: 'Hi & bye?',
        body: 'Line 1\nLine 2 #1',
      }),
    ).toBe(
      'mailto:maksymilianwojnowski@gmail.com?subject=Hi%20%26%20bye%3F&body=Line%201%0D%0ALine%202%20%231',
    )
  })

  it('round-trips emoji and unicode', () => {
    const url = buildMailto({ to: 'a@b.c', subject: 's', body: 'Cześć 👋\nOK' })
    const body = url.slice(url.indexOf('body=') + 'body='.length)
    expect(decodeURIComponent(body)).toBe('Cześć 👋\r\nOK')
  })
})
