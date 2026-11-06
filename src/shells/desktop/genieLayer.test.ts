import { afterEach, describe, expect, it, vi } from 'vitest'
import { cancelGenie, playGenie } from './genieLayer'
import { stripCount } from './genie'

const box = { x: 100, y: 50, width: 400, height: 300 }
const icon = { x: 600, y: 800, width: 52, height: 52 }

function fakeAnim() {
  return {
    onfinish: null as null | (() => void),
    oncancel: null as null | (() => void),
    cancel: vi.fn(),
    finished: new Promise<void>(() => {}),
  }
}

function stubAnimate() {
  const animate = vi.fn(() => fakeAnim())
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
  return animate
}

function makeWindow(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.append(el)
  return el
}

const layerOf = () => document.querySelector<HTMLElement>('[data-genie-layer]')

afterEach(() => {
  document.body.innerHTML = ''
  Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTop')
  vi.restoreAllMocks()
})

describe('playGenie', () => {
  it('builds one aria-hidden inert strip per stripCount, each a clone clipped to its band', () => {
    const animate = stubAnimate()
    const win = makeWindow('<p>a</p><p>b</p>')
    const count = stripCount(win.querySelectorAll('*').length)
    playGenie(win, box, icon, 'minimize', 'w')
    const layer = layerOf()
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    expect(layer?.hasAttribute('inert')).toBe(true)
    expect(layer?.children).toHaveLength(count ?? -1)
    expect(animate).toHaveBeenCalledTimes(count ?? -1)
  })

  it('clones carry no ids and no iframe, video or audio', () => {
    stubAnimate()
    const win = makeWindow('<p id="title">t</p><iframe src="about:blank"></iframe><video></video><audio></audio>')
    playGenie(win, box, icon, 'minimize', 'w')
    const layer = layerOf() as HTMLElement
    expect(layer.querySelector('[id]')).toBeNull()
    expect(layer.querySelector('iframe, video, audio')).toBeNull()
    expect(win.querySelector('#title')).not.toBeNull()
  })

  it('copies scroll offsets into the clones', () => {
    stubAnimate()
    Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
      get() {
        return (this as { _st?: number })._st ?? 0
      },
      set(v: number) {
        ;(this as { _st?: number })._st = v
      },
      configurable: true,
    })
    const win = makeWindow('<div id="list"></div>')
    const list = win.querySelector('div') as HTMLElement
    list.scrollTop = 120
    playGenie(win, box, icon, 'minimize', 'w')
    // Layer children in order: strip wrapper, window clone, list clone.
    const copy = layerOf()?.querySelectorAll('div')[2] as HTMLElement
    expect(copy.scrollTop).toBe(120)
  })

  it('removes the layer when every animation finishes', () => {
    const animate = stubAnimate()
    const win = makeWindow('<p>a</p>')
    playGenie(win, box, icon, 'minimize', 'w')
    expect(layerOf()).not.toBeNull()
    for (const r of animate.mock.results) (r.value as ReturnType<typeof fakeAnim>).onfinish?.()
    expect(layerOf()).toBeNull()
  })

  it('removes the layer when cancelled', () => {
    const animate = stubAnimate()
    const win = makeWindow('<p>a</p>')
    playGenie(win, box, icon, 'minimize', 'w')
    ;(animate.mock.results[0].value as ReturnType<typeof fakeAnim>).oncancel?.()
    expect(layerOf()).toBeNull()
  })

  it("cancelGenie removes only that window's layer", () => {
    stubAnimate()
    const a = makeWindow('<p>a</p>')
    const b = makeWindow('<p>b</p>')
    playGenie(a, box, icon, 'minimize', 'a')
    playGenie(b, box, icon, 'minimize', 'b')
    expect(document.querySelectorAll('[data-genie-layer]')).toHaveLength(2)
    cancelGenie('a')
    expect(document.querySelectorAll('[data-genie-layer]')).toHaveLength(1)
    cancelGenie('b')
    expect(layerOf()).toBeNull()
  })

  it('returns null when the element has no animate', () => {
    const win = makeWindow('<p>a</p>')
    expect(playGenie(win, box, icon, 'minimize', 'w')).toBeNull()
    expect(layerOf()).toBeNull()
  })
})
