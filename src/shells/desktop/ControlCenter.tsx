import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { getContent } from '../../content'
import { dispatch } from '../../system/commands'
import { Popover } from '../../ui/Popover'
import { Switch } from '../../ui/Switch'
import { useSystem } from '../../system/store'
import type { Appearance } from '../../system/settings'
import { enterFullScreen, exitFullScreen } from './fullscreen'

const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }

const GLASS = {
  background: 'var(--glass-bg)',
  backdropFilter: 'blur(var(--glass-blur))',
  borderColor: 'var(--glass-border)',
}

function Tile({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[12px] border p-3" style={GLASS}>
      {children}
    </section>
  )
}

// Anchored under the Control Center status button; the button's element is passed in, not read during render.
export function ControlCenter({ anchorEl }: { anchorEl: HTMLElement }) {
  const [anchor] = useState(() => anchorEl.getBoundingClientRect())
  const settings = useSystem((s) => s.settings)
  const updateSettings = useSystem((s) => s.updateSettings)
  const setOverlay = useSystem((s) => s.setOverlay)
  const setKeyboardLocked = useSystem((s) => s.setKeyboardLocked)
  const close = useCallback(() => setOverlay(null), [setOverlay])
  const wallpapers = getContent().site.wallpapers
  const canFullScreen = document.fullscreenEnabled === true

  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    // Escape or the browser's own control can leave full screen while the panel is open.
    const sync = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Radio group: arrows move and select (wrapping), and only the selected radio is in the tab order.
  const onAppearanceKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[e.key]
    if (step === undefined) return
    e.preventDefault()
    const current = APPEARANCES.findIndex((a) => a.value === settings.appearance)
    const next = (current + step + APPEARANCES.length) % APPEARANCES.length
    updateSettings({ appearance: APPEARANCES[next].value })
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  const toggleFullScreen = async () => {
    if (fullscreen) {
      await exitFullScreen()
      setKeyboardLocked(false)
      setFullscreen(false)
    } else {
      const r = await enterFullScreen()
      setKeyboardLocked(r.keyboardLocked)
      setFullscreen(r.fullscreen)
    }
  }

  return (
    <Popover anchor={anchor} onClose={close} label="Control Center" anchorEl={anchorEl}>
      <div className="flex w-[320px] flex-col gap-2">
        <Tile>
          <div
            role="radiogroup"
            aria-label="Appearance"
            onKeyDown={onAppearanceKey}
            className="grid grid-cols-3 gap-1 rounded-[8px] bg-black/5 p-0.5 dark:bg-white/10"
          >
            {APPEARANCES.map((a) => {
              const checked = settings.appearance === a.value
              return (
                <button
                  key={a.value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => updateSettings({ appearance: a.value })}
                  className={`h-[24px] rounded-[6px] text-[12px] ${
                    checked ? 'bg-white font-medium text-black shadow dark:bg-white/25 dark:text-white' : 'text-text-1'
                  }`}
                >
                  {a.label}
                </button>
              )
            })}
          </div>
        </Tile>

        <Tile>
          <button
            type="button"
            onClick={() => dispatch({ type: 'overlay.open', overlay: 'missionControl' })}
            className="h-[26px] w-full rounded-[6px] bg-black/5 text-[13px] dark:bg-white/10"
          >
            Mission Control
          </button>
        </Tile>

        <Tile>
          <div className="flex flex-col gap-1">
            <Switch
              label="Reduce motion"
              checked={settings.reduceMotion}
              onChange={(v) => updateSettings({ reduceMotion: v })}
            />
            <Switch
              label="Reduce transparency"
              checked={settings.reduceTransparency}
              onChange={(v) => updateSettings({ reduceTransparency: v })}
            />
            <Switch
              label="Dock magnification"
              checked={settings.dockMagnification}
              onChange={(v) => updateSettings({ dockMagnification: v })}
            />
          </div>
        </Tile>

        <Tile>
          <div className="flex gap-2">
            {wallpapers.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-label={w.name}
                aria-pressed={settings.wallpaperId === w.id}
                title={w.name}
                onClick={() => updateSettings({ wallpaperId: w.id })}
                className="h-[40px] flex-1 rounded-[8px] aria-pressed:ring-2 aria-pressed:ring-accent-link aria-pressed:ring-offset-2"
                style={{ backgroundImage: w.gradient }}
              />
            ))}
          </div>
        </Tile>

        {canFullScreen && (
          <Tile>
            <button
              type="button"
              onClick={toggleFullScreen}
              className="h-[26px] w-full rounded-[6px] bg-black/5 text-[13px] dark:bg-white/10"
            >
              {fullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            </button>
          </Tile>
        )}
      </div>
    </Popover>
  )
}
