import { useEffect } from 'react'
import { X } from 'lucide-react'
import { MENU_BAR_H } from '../../system/layout'
import { useSystem, type Banner } from '../../system/store'

export const BANNER_MS = 5000

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  borderColor: 'var(--glass-border)',
}

function BannerCard({ banner }: { banner: Banner }) {
  const dismiss = useSystem((s) => s.dismissBanner)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(banner.id), BANNER_MS)
    return () => clearTimeout(timer)
  }, [banner.id, dismiss])

  return (
    <div className="relative w-[340px] rounded-[12px] border p-3 pr-9 shadow-lg" style={GLASS}>
      <p className="text-[13px] font-semibold text-text-1">{banner.title}</p>
      {banner.body && <p className="mt-0.5 text-[12px] text-text-2">{banner.body}</p>}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(banner.id)}
        className="absolute top-2 right-2 flex h-[20px] w-[20px] items-center justify-center rounded-full text-text-2 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/15"
      >
        <X aria-hidden="true" className="h-3 w-3" />
      </button>
    </div>
  )
}

// Always mounted so screen readers announce banners as they are added.
export function Banners() {
  const banners = useSystem((s) => s.banners)
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 flex flex-col gap-2"
      style={{ top: MENU_BAR_H + 8, right: 8 }}
    >
      {banners.map((b) => (
        <BannerCard key={b.id} banner={b} />
      ))}
    </div>
  )
}
