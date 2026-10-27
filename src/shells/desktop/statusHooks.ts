import { useEffect, useState, useSyncExternalStore } from 'react'

interface BatteryManagerLike {
  level: number
  charging: boolean
  addEventListener(type: 'levelchange' | 'chargingchange', fn: () => void): void
  removeEventListener(type: 'levelchange' | 'chargingchange', fn: () => void): void
}

// getBattery is absent from the DOM typings and from some browsers.
const batteryNavigator = () =>
  navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }

export function useBattery(): { level: number; charging: boolean } | null {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null)

  useEffect(() => {
    const getBattery = batteryNavigator().getBattery
    if (typeof getBattery !== 'function') return
    let manager: BatteryManagerLike | undefined
    let cancelled = false
    const sync = () => {
      if (manager) setBattery({ level: manager.level, charging: manager.charging })
    }
    getBattery
      .call(navigator)
      .then((m) => {
        if (cancelled) return
        manager = m
        sync()
        m.addEventListener('levelchange', sync)
        m.addEventListener('chargingchange', sync)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (manager) {
        manager.removeEventListener('levelchange', sync)
        manager.removeEventListener('chargingchange', sync)
      }
    }
  }, [])

  return battery
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
}
