import { genieKeyframes, GENIE_MS, stripCount, type Box } from './genie'

const STEPS = 24
const MEDIA = 'iframe, video, audio'

// Running layers by window id, so a restore can cancel the minimize it interrupts.
const running = new Map<string, { layer: HTMLElement; anims: Animation[] }>()

// Cancels the running genie of one window and removes its layer. With `anims`, only that run is cancelled,
// so an old restore cleaning up cannot cancel a newer minimize of the same window.
export function cancelGenie(windowId: string, anims?: Animation[]): void {
  const entry = running.get(windowId)
  if (!entry || (anims && entry.anims !== anims)) return
  running.delete(windowId)
  entry.anims.forEach((a) => a.cancel())
  entry.layer.remove()
}

// Iframes and media cannot be cloned live, so each becomes a box of the same size.
// Returns the original/clone pairs whose scroll offsets are copied once the clone is attached.
function sanitise(source: HTMLElement, clone: HTMLElement): [Element, Element][] {
  const originals = [source, ...Array.from(source.querySelectorAll('*'))]
  const copies = [clone, ...Array.from(clone.querySelectorAll('*'))]
  const scrolls: [Element, Element][] = []
  copies.forEach((copy, j) => {
    const orig = originals[j]
    copy.removeAttribute('id')
    if (copy.matches(MEDIA)) {
      const r = orig.getBoundingClientRect()
      const stand = document.createElement('div')
      stand.style.width = `${r.width}px`
      stand.style.height = `${r.height}px`
      copy.replaceWith(stand)
    } else {
      scrolls.push([orig, copy])
    }
  })
  return scrolls
}

// Clones the source into one band-clipped strip per stripCount and animates the strips along the genie frames.
// Returns null when the effect cannot run, so the caller falls back to the Scale minimize.
export function playGenie(
  source: HTMLElement,
  from: Box,
  to: Box,
  direction: 'minimize' | 'restore',
  windowId: string,
): Animation[] | null {
  if (typeof source.animate !== 'function') return null
  const count = stripCount(source.querySelectorAll('*').length)
  if (count === null) return null

  const bandH = from.height / count
  const frames = genieKeyframes(from, to, count, STEPS)
  const layer = document.createElement('div')
  layer.dataset.genieLayer = ''
  layer.setAttribute('aria-hidden', 'true')
  layer.setAttribute('inert', '')
  layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:70;pointer-events:none'

  const scrolls: [Element, Element][] = []
  for (let i = 0; i < count; i++) {
    const clone = source.cloneNode(true) as HTMLElement
    scrolls.push(...sanitise(source, clone))
    // The window's own open animation would replay inside the clone.
    clone.style.cssText += `;position:absolute;left:0px;top:0px;width:${from.width}px;height:${from.height}px;animation:none`
    const wrap = document.createElement('div')
    wrap.style.cssText = `position:absolute;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;transform-origin:0 0;clip-path:inset(${i * bandH}px 0px ${from.height - (i + 1) * bandH}px 0px)`
    wrap.append(clone)
    layer.append(wrap)
  }
  document.body.append(layer)
  for (const [orig, copy] of scrolls) {
    if (orig.scrollTop || orig.scrollLeft) {
      copy.scrollTop = orig.scrollTop
      copy.scrollLeft = orig.scrollLeft
    }
  }

  const anims = Array.from(layer.children).map((wrap, i) => {
    // Restore plays the minimize frames backwards: the strips leave the Dock icon and land on the window.
    const keyframes =
      direction === 'minimize'
        ? frames[i]
        : frames[i]
            .slice()
            .reverse()
            .map((f) => ({ ...f, offset: 1 - (f.offset ?? 0) }))
    return (wrap as HTMLElement).animate(keyframes, { duration: GENIE_MS, easing: 'linear', fill: 'forwards' })
  })

  const entry = { layer, anims }
  running.set(windowId, entry)
  let left = anims.length
  const release = () => {
    layer.remove()
    if (running.get(windowId) === entry) running.delete(windowId)
  }
  for (const anim of anims) {
    anim.onfinish = () => {
      if (--left === 0) release()
    }
    anim.oncancel = release
  }
  return anims
}
