import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '../registry'
import QuickLookApp from './QuickLook'

// A file whose app is not registered, so Quick Look shows its coming-soon footer.
vi.mock('../finder/vfsInstance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../finder/vfsInstance')>()
  return {
    ...actual,
    nodeById: (id: unknown) =>
      id === 'synthetic-link'
        ? {
            id: 'synthetic-link',
            name: 'Example.webloc',
            kind: 'file',
            fileType: 'webloc',
            open: { appId: 'not-installed' },
            preview: { kind: 'link', title: 'Example', url: 'https://example.com/', description: 'An example site' },
          }
        : actual.nodeById(id),
  }
})

const COMING_SOON = 'Preview — the full app is coming soon.'

describe('QuickLook', () => {
  afterEach(cleanup)

  it('previews a file whose app is not installed, with the coming-soon footer', () => {
    render(<QuickLookApp windowId="w1" props={{ nodeId: 'synthetic-link' }} />)

    expect(screen.getByRole('button', { name: 'Open in new tab ↗' })).toBeInTheDocument()
    expect(screen.getByText(COMING_SOON)).toBeInTheDocument()
  })

  it('previews a markdown file in its own app without the footer', () => {
    render(<QuickLookApp windowId="w1" props={{ nodeId: 'project-ligapwr' }} />)

    expect(screen.queryByText(COMING_SOON)).not.toBeInTheDocument()
  })
})
