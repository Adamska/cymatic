import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const BOOT_TIMEOUT_MS = 15000

// Start downloading the 3D stage right away instead of waiting for React to request it.
void import('./scene/Stage')

function dismissBoot(): void {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('boot-done')
  window.setTimeout(() => boot.remove(), 1000)
}

window.addEventListener('cymatic:ready', dismissBoot, { once: true })
window.setTimeout(dismissBoot, BOOT_TIMEOUT_MS)

const container = document.getElementById('root')
if (!container) throw new Error('Root container is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
