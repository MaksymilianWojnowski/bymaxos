import { getContent } from '../../content'
import { useSystem } from '../../system/store'

// Image layers sit over the gradient; relative src paths are served under the Vite base.
function imageUrl(src: string): string {
  return /^https?:\/\//.test(src) ? src : import.meta.env.BASE_URL + src.replace(/^\/+/, '')
}

export function Wallpaper() {
  const wallpaperId = useSystem((s) => s.settings.wallpaperId)
  const wallpapers = getContent().site.wallpapers
  const wallpaper =
    wallpapers.find((w) => w.id === wallpaperId) ??
    wallpapers.find((w) => w.id === 'default') ??
    wallpapers[0]
  const backgroundImage = wallpaper.src
    ? `url("${imageUrl(wallpaper.src)}"), ${wallpaper.gradient}`
    : wallpaper.gradient

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage }}
    />
  )
}
