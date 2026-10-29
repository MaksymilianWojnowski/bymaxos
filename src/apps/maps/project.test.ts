import { describe, expect, it } from 'vitest'
import { MAP_H, MAP_W, project } from './project'
import { WORLD_PATH } from './worldPath'

describe('project', () => {
  it('maps the equator and prime meridian to the map centre', () => {
    expect(project(0, 0)).toEqual({ x: 500, y: 250 })
  })

  it('maps the corners of the lat/lon box to the corners of the map', () => {
    expect(project(90, -180)).toEqual({ x: 0, y: 0 })
    expect(project(-90, 180)).toEqual({ x: MAP_W, y: MAP_H })
  })

  it('places Wrocław on the map (equirectangular, 2 decimals)', () => {
    const { x, y } = project(51.1079, 17.0385)
    expect(x).toBeCloseTo(547.33, 2)
    expect(y).toBeCloseTo(108.03, 2)
  })
})

describe('worldPath', () => {
  it('is an SVG path that starts with M and has real outline data', () => {
    expect(WORLD_PATH.startsWith('M')).toBe(true)
    expect(WORLD_PATH.length).toBeGreaterThan(1000)
  })
})
