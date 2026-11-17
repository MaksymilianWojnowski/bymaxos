import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNetwork } from './statusHooks'

type ConnectionStub = {
  effectiveType: string
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

const setConnection = (connection: ConnectionStub | undefined) => {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true })
}

describe('useNetwork', () => {
  afterEach(() => {
    setConnection(undefined)
  })

  it('maps effectiveType to bars', () => {
    setConnection({ effectiveType: '3g', addEventListener: () => {}, removeEventListener: () => {} })
    const { result } = renderHook(() => useNetwork())
    expect(result.current?.bars).toBe(3)
    expect(result.current?.type).toBe('3g')
  })

  it('is null without the API', () => {
    setConnection(undefined)
    const { result } = renderHook(() => useNetwork())
    expect(result.current).toBeNull()
  })

  it('useNetwork updates on the change event', () => {
    const listeners: Array<() => void> = []
    const connection = {
      effectiveType: '4g',
      addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
      removeEventListener: () => {},
    }
    setConnection(connection)
    const { result } = renderHook(() => useNetwork())
    expect(result.current?.bars).toBe(4)
    connection.effectiveType = '2g'
    act(() => listeners.forEach((fn) => fn()))
    expect(result.current?.bars).toBe(2)
  })

  it('useNetwork removes its listener on unmount', () => {
    const removeEventListener = vi.fn()
    setConnection({ effectiveType: '4g', addEventListener: () => {}, removeEventListener })
    const { unmount } = renderHook(() => useNetwork())
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('useNetwork is null for an unmapped effectiveType', () => {
    for (const effectiveType of ['5g', 'constructor']) {
      setConnection({ effectiveType, addEventListener: () => {}, removeEventListener: () => {} })
      const { result } = renderHook(() => useNetwork())
      expect(result.current).toBeNull()
    }
  })
})
