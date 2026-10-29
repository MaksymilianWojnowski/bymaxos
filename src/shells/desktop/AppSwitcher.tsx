import { getApp } from '../../apps/registry'
import { useSystem } from '../../system/store'
import { AppIcon } from '../../ui/AppIcon'

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  borderColor: 'var(--glass-border)',
}

// Shown while Option is held: releasing Option, or clicking an app, commits the highlighted one.
export function AppSwitcher() {
  const switcher = useSystem((s) => s.switcher)
  const switcherCommit = useSystem((s) => s.switcherCommit)
  if (!switcher) return null
  const selected = getApp(switcher.appIds[switcher.index])

  return (
    <div
      className="fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-[18px] border p-3 font-sans text-text-1"
      style={GLASS}
    >
      <div role="listbox" aria-label="App Switcher" className="flex gap-1">
        {switcher.appIds.map((appId, i) => {
          const app = getApp(appId)
          const isSelected = i === switcher.index
          return (
            <button
              key={appId}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={app?.name ?? appId}
              onClick={() => switcherCommit(i)}
              className={`flex h-[112px] w-[112px] items-center justify-center rounded-[14px] ${isSelected ? 'bg-black/15 ring-2 ring-text-1 dark:bg-white/25' : ''}`}
            >
              {app && <AppIcon app={app} size={96} />}
            </button>
          )
        })}
      </div>
      <p className="mt-2 h-[18px] text-[13px] leading-[18px]">{selected?.name}</p>
    </div>
  )
}
