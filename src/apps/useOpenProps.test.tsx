import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOpenProps } from './useOpenProps'

describe('useOpenProps', () => {
  it('applies on mount', () => {
    const apply = vi.fn()
    const props = { item: 'a' }
    renderHook(() => useOpenProps(props, apply))
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(props)
  })

  it('applies again for a new object with the same item', () => {
    const apply = vi.fn()
    const { rerender } = renderHook(({ props }) => useOpenProps(props, apply), {
      initialProps: { props: { item: 'a' } as Record<string, unknown> | undefined },
    })
    rerender({ props: { item: 'a' } })
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it('does not apply on a re-render with the same object', () => {
    const apply = vi.fn()
    const props = { item: 'a' }
    const { rerender } = renderHook(({ props }) => useOpenProps(props, apply), { initialProps: { props } })
    rerender({ props })
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('does nothing without props', () => {
    const apply = vi.fn()
    renderHook(() => useOpenProps(undefined, apply))
    expect(apply).not.toHaveBeenCalled()
  })
})
