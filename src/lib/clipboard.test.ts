import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard
})

describe('copyText', () => {
  it('resolves true when navigator.clipboard.writeText resolves', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    await expect(copyText('a@b.c')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('a@b.c')
  })

  it('resolves false when writeText rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    await expect(copyText('a@b.c')).resolves.toBe(false)
  })

  it('resolves false when navigator.clipboard is undefined', async () => {
    setClipboard(undefined)
    await expect(copyText('a@b.c')).resolves.toBe(false)
  })
})
