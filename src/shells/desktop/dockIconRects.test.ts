import { afterEach, describe, expect, it } from 'vitest'
import { dockIconRect, dockIconRects } from './dockIconRects'

afterEach(() => {
  document.body.innerHTML = ''
  dockIconRects.clear()
})

describe('dockIconRect', () => {
  it('measures the live Dock icon when it is mounted', () => {
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    const icon = document.createElement('button')
    icon.dataset.dockApp = 'finder'
    icon.getBoundingClientRect = () => new DOMRect(300, 720, 60, 60)
    document.body.append(icon)
    expect(dockIconRect('finder')).toMatchObject({ x: 300, y: 720, width: 60, height: 60 })
  })

  it('falls back to the stored rect when the icon is not in the DOM', () => {
    dockIconRects.set('finder', new DOMRect(10, 700, 52, 52))
    expect(dockIconRect('finder')).toMatchObject({ x: 10, y: 700, width: 52, height: 52 })
    expect(dockIconRect('safari')).toBeUndefined()
  })
})
