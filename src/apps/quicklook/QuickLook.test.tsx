import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '../registry'
import QuickLookApp from './QuickLook'

const COMING_SOON = 'Preview — the full app is coming soon.'

describe('QuickLook', () => {
  afterEach(cleanup)

  it('previews a webloc whose app is not installed, with the coming-soon footer', () => {
    render(<QuickLookApp windowId="w1" props={{ nodeId: 'project-ligapwr-repo' }} />)

    expect(screen.getByRole('button', { name: 'Open in new tab ↗' })).toBeInTheDocument()
    expect(screen.getByText(COMING_SOON)).toBeInTheDocument()
  })

  it('previews a markdown file in its own app without the footer', () => {
    render(<QuickLookApp windowId="w1" props={{ nodeId: 'project-ligapwr' }} />)

    expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument()
  })
})
