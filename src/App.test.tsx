import { it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders the bymaxOS root', () => {
  render(<App />)
  expect(screen.getByTestId('bymaxos-root')).toBeInTheDocument()
})
