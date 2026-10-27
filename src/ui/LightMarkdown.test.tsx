import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LightMarkdown } from './LightMarkdown'

describe('LightMarkdown', () => {
  it('renders headings, list runs and blank-line paragraphs', () => {
    const { container } = render(
      <LightMarkdown source={'# Title\n\nFirst line\nsecond line\n\n- one\n- two'} />,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Title' })).toBeInTheDocument()
    expect(screen.getByText('First line second line')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two'])
    expect(container.querySelectorAll('ul')).toHaveLength(1)
  })

  it('keeps HTML in the source as text', () => {
    render(<LightMarkdown source={'<img src=x onerror="alert(1)">'} />)
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
