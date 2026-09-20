import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installStorageFallback } from './utils/safeStorage.js'

// Has to run before App renders, because App reads storage during render.
installStorageFallback()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
