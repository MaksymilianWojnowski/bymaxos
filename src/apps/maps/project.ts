export const MAP_W = 1000
export const MAP_H = 500

// Equirectangular, the same projection scripts/build-world-map.mjs uses for the land outline, so pins line up.
export function project(lat: number, lon: number): { x: number; y: number } {
  return { x: ((lon + 180) * MAP_W) / 360, y: ((90 - lat) * MAP_H) / 180 }
}
