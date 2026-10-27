import { describe, expect, it, vi } from 'vitest'
import { enterFullScreen, exitFullScreen } from './fullscreen'

const fakeDoc = (requestFullscreen: () => Promise<void>, exitFullscreen = vi.fn(async () => {})) =>
  ({
    documentElement: { requestFullscreen },
    fullscreenElement: null,
    exitFullscreen,
  }) as unknown as Document

describe('enterFullScreen', () => {
  it('enters full screen and locks the keyboard when the browser supports it', async () => {
    const lock = vi.fn(async () => {})
    const doc = fakeDoc(async () => {})
    const nav = { keyboard: { lock } } as unknown as Navigator
    await expect(enterFullScreen(doc, nav)).resolves.toEqual({ fullscreen: true, keyboardLocked: true })
    expect(lock).toHaveBeenCalledWith(expect.arrayContaining(['MetaLeft', 'KeyW', 'Tab']))
  })

  it('stays unlocked when the Keyboard Lock API is absent', async () => {
    const doc = fakeDoc(async () => {})
    await expect(enterFullScreen(doc, {} as Navigator)).resolves.toEqual({
      fullscreen: true,
      keyboardLocked: false,
    })
  })

  it('reports no full screen and no lock when the request is rejected, without throwing', async () => {
    const doc = fakeDoc(() => Promise.reject(new Error('denied')))
    const lock = vi.fn(async () => {})
    const nav = { keyboard: { lock } } as unknown as Navigator
    await expect(enterFullScreen(doc, nav)).resolves.toEqual({ fullscreen: false, keyboardLocked: false })
    expect(lock).not.toHaveBeenCalled()
  })
})

describe('exitFullScreen', () => {
  it('leaves full screen when the document is in it', async () => {
    const exitFullscreen = vi.fn(async () => {})
    const doc = { ...fakeDoc(async () => {}, exitFullscreen), fullscreenElement: {} } as unknown as Document
    await exitFullScreen(doc)
    expect(exitFullscreen).toHaveBeenCalledOnce()
  })

  it('does nothing and does not throw when not in full screen', async () => {
    const exitFullscreen = vi.fn(async () => {})
    await expect(exitFullScreen(fakeDoc(async () => {}, exitFullscreen))).resolves.toBeUndefined()
    expect(exitFullscreen).not.toHaveBeenCalled()
  })
})
