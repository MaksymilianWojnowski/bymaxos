import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { getContent } from '../../content'
import { ACCENTS, type Accent, type Appearance } from '../../system/settings'
import { useShell } from '../../system/shell'
import { useSystem } from '../../system/store'
import { NavStack } from '../../ui/NavStack'
import { Switch } from '../../ui/Switch'
import type { AppProps } from '../types'
import { useOpenProps } from '../useOpenProps'

type Section = 'appearance' | 'wallpaper' | 'accessibility' | 'dock'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'wallpaper', label: 'Wallpaper' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'dock', label: 'Dock' },
]

const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto' },
]

// Swatch colours match each accent's --accent token in tokens.css.
const SWATCH: Record<Accent, string> = {
  blue: '#0a84ff',
  purple: '#a550a7',
  pink: '#f74f9e',
  red: '#ff5257',
  orange: '#f7821b',
  yellow: '#ffc600',
  green: '#62ba46',
  graphite: '#8c8c8c',
}

const ACCENT_OPTIONS = ACCENTS.map((a) => ({
  value: a,
  label: `${a[0].toUpperCase()}${a.slice(1)}`,
  style: { backgroundColor: SWATCH[a] },
}))

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }

interface Option<T extends string> {
  value: T
  label: string
  style?: CSSProperties
}

// Radio group: arrows move and select (wrapping), and only the selected radio is in the tab order.
function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  itemClass,
  showText = false,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  className: string
  itemClass: string
  showText?: boolean
}) {
  // A stale value (an id no option has) leaves no selected radio, so the first one takes the tab stop.
  const tabStop = options.some((o) => o.value === value) ? value : options[0]?.value

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[e.key]
    if (step === undefined) return
    e.preventDefault()
    const current = options.findIndex((o) => o.value === value)
    const next = (current + step + options.length) % options.length
    onChange(options[next].value)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className={className}>
      {options.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.label}
            title={o.label}
            tabIndex={o.value === tabStop ? 0 : -1}
            onClick={() => onChange(o.value)}
            style={o.style}
            className={itemClass}
          >
            {showText ? o.label : null}
          </button>
        )
      })}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-text-2">{label}</span>
      {children}
    </div>
  )
}

export default function SettingsApp({ props }: AppProps) {
  const shell = useShell()
  // The Dock section is a desktop-only setting, so a phone never lists it or opens it.
  const sections = shell === 'mobile' ? SECTIONS.filter((s) => s.id !== 'dock') : SECTIONS
  const [section, setSection] = useState<Section>(
    () => sections.find((s) => s.id === props?.item)?.id ?? 'appearance',
  )
  // Phones show the list or one section at a time; a valid item opens its section.
  const [detailOpen, setDetailOpen] = useState(() => sections.some((s) => s.id === props?.item))
  // A new item while Settings is open switches section, as a deep link from Spotlight or Terminal does.
  useOpenProps(props, (p) => {
    const hit = sections.find((s) => s.id === p.item)
    if (hit) {
      setSection(hit.id)
      setDetailOpen(true)
    }
  })
  const settings = useSystem((s) => s.settings)
  const updateSettings = useSystem((s) => s.updateSettings)
  const wallpapers = getContent().site.wallpapers
  const current = sections.find((s) => s.id === section) ?? sections[0]

  const sectionList = (
    <nav
      aria-label="Settings sections"
      className={
        shell === 'mobile'
          ? 'flex flex-col gap-0.5 p-2'
          : 'flex w-[180px] shrink-0 flex-col gap-0.5 overflow-auto border-r border-black/10 bg-sidebar p-2 dark:border-white/10'
      }
    >
      {sections.map((s) => {
        const selected = s.id === current.id && (shell !== 'mobile' || detailOpen)
        return (
          <button
            key={s.id}
            type="button"
            aria-current={selected ? 'page' : undefined}
            onClick={() => {
              setSection(s.id)
              setDetailOpen(true)
            }}
            className={`rounded-[6px] px-2 py-1 text-left phone:min-h-11 ${
              selected ? 'bg-accent-strong text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </nav>
  )

  const content = (
    <>
      {current.id === 'appearance' && (
        <>
          <Row label="Mode">
            <RadioGroup
              label="Appearance"
              options={APPEARANCES}
              value={settings.appearance}
              onChange={(v) => updateSettings({ appearance: v })}
              className="grid w-[260px] grid-cols-3 gap-1 rounded-[8px] bg-black/5 p-0.5 phone:w-full dark:bg-white/10"
              itemClass="h-[26px] rounded-[6px] phone:h-11 text-[12px] aria-checked:bg-white aria-checked:font-medium aria-checked:text-black aria-checked:shadow dark:aria-checked:bg-white/25 dark:aria-checked:text-white"
              showText
            />
          </Row>
          <Row label="Accent colour">
            <RadioGroup
              label="Accent colour"
              options={ACCENT_OPTIONS}
              value={settings.accent}
              onChange={(v) => updateSettings({ accent: v })}
              className="flex flex-wrap gap-3"
              itemClass="h-[24px] w-[24px] rounded-full phone:h-11 phone:w-11 ring-offset-2 ring-offset-window aria-checked:ring-2 aria-checked:ring-accent-link"
            />
          </Row>
        </>
      )}

      {current.id === 'wallpaper' && (
        <RadioGroup
          label="Wallpaper"
          options={wallpapers.map((w) => ({ value: w.id, label: w.name, style: { backgroundImage: w.gradient } }))}
          value={settings.wallpaperId}
          onChange={(v) => updateSettings({ wallpaperId: v })}
          className="grid grid-cols-2 gap-3"
          itemClass="h-[72px] rounded-[8px] ring-offset-2 ring-offset-window aria-checked:ring-2 aria-checked:ring-accent-link"
        />
      )}

      {current.id === 'accessibility' && (
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
        </div>
      )}

      {current.id === 'dock' && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <span className="w-[80px] shrink-0">Size</span>
            <input
              type="range"
              min={40}
              max={72}
              step={4}
              value={settings.dockSize}
              onChange={(e) => updateSettings({ dockSize: Number(e.target.value) })}
              className="flex-1 accent-accent-strong dark:accent-accent"
            />
          </label>
          <Switch
            label="Magnification"
            checked={settings.dockMagnification}
            onChange={(v) => updateSettings({ dockMagnification: v })}
          />
        </div>
      )}
    </>
  )

  if (shell === 'mobile') {
    return (
      <div className="h-full min-h-0 font-sans text-[13px] text-text-1">
        <NavStack
          title="Settings"
          list={sectionList}
          open={detailOpen}
          detailTitle={current.label}
          onBack={() => setDetailOpen(false)}
          detail={<div className="flex flex-col gap-5 p-5">{content}</div>}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 font-sans text-[13px] text-text-1">
      {sectionList}
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto bg-window p-5">
        <h2 className="text-[15px] font-semibold">{current.label}</h2>
        {content}
      </div>
    </div>
  )
}
