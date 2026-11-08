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

export function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now
}

interface NetworkInformationLike {
  effectiveType?: string
  addEventListener(type: 'change', fn: () => void): void
  removeEventListener(type: 'change', fn: () => void): void
}

// connection is absent from the DOM typings and from Safari and Firefox.
const networkNavigator = () =>
  navigator as Navigator & { connection?: NetworkInformationLike }

const BARS: Partial<Record<string, 1 | 2 | 3 | 4>> = { 'slow-2g': 1, '2g': 2, '3g': 3, '4g': 4 }

// Effective connection quality, not signal strength: the only network reading a web page gets.
export function useNetwork(): { bars: 1 | 2 | 3 | 4; type?: string } | null {
  const [network, setNetwork] = useState<{ bars: 1 | 2 | 3 | 4; type?: string } | null>(null)

  useEffect(() => {
    const connection = networkNavigator().connection
    if (!connection) return
    const sync = () => {
      const type = connection.effectiveType
      const bars = type ? BARS[type] : undefined
      setNetwork(bars ? { bars, type } : null)
    }
    sync()
    connection.addEventListener('change', sync)
    return () => connection.removeEventListener('change', sync)
  }, [])

  return network
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
