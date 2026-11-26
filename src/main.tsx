import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/manrope'
import '@fontsource-variable/gluten'
import '@fontsource-variable/nunito'
import '@fontsource/fredoka/500.css'
import '@fontsource/bebas-neue'
import './styles.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { trackError } from './lib/telemetry'

window.addEventListener('error', (event) => trackError(event.error ?? event.message, { source: 'window' }))
window.addEventListener('unhandledrejection', (event) => trackError(event.reason, { source: 'promise' }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app"><App /></ErrorBoundary>
  </StrictMode>
)
