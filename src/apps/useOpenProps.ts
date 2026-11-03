import { useState } from 'react'
import type { AppProps } from './types'

// A phone app stays mounted after going home, so new props arrive on a live app. A new props object
// is a new open, even when it names the same item. Adjusted during render, as the apps already do,
// so the change lands in the same pass.
export function useOpenProps(props: AppProps['props'], apply: (props: Record<string, unknown>) => void): void {
  const [seen, setSeen] = useState<AppProps['props']>(undefined)
  if (props !== seen) {
    setSeen(props)
    if (props) apply(props)
  }
}
