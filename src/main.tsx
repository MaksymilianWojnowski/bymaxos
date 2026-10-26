import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/global.css'
import App from './App.tsx'
import { applyAppearance, defaultSettings } from './system/settings'

const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
applyAppearance(defaultSettings({ prefersReducedMotion }), prefersDark)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
