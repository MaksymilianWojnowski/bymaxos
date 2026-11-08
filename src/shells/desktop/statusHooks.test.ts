import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNetwork } from './statusHooks'

type ConnectionStub = { effectiveType: string; addEventListener: () => void; removeEventListener: () => void }

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
})
